// =====================================================================================
// Servicos.js — tela "LAVAGENS E MANUTENÇÕES" (só o ADMIN acessa).
//
// O que a tela faz:
//   1) Duas abas no topo: Manutenções e Lavagens (a mesma tela serve para as duas).
//   2) Lista com busca (placa ou motorista), período (Tudo / 7 / 30 / 90 dias) e
//      "Carregar mais" (a API devolve 20 por vez).
//   3) "+ Novo" abre o formulário para registrar.
//   4) Em cada item: "Editar" (abre o formulário preenchido) e "Excluir" (dois toques).
//
// Conversa com a API (LavagemController.php e ManutencaoController.php):
//   GET    /manutencoes  ou  /lavagens        -> lista
//   POST   /manutencoes  ou  /lavagens        -> registra
//   PUT    /manutencoes/{id} ou /lavagens/{id} -> altera
//   DELETE /manutencoes/{id} ou /lavagens/{id} -> exclui
// O endereço é montado com a aba escolhida: `/${aba}` vira "/manutencoes" ou "/lavagens".
// =====================================================================================

// ---------- Importações ----------
// useState = guarda valores que redesenham a tela quando mudam;
// useEffect = executa algo quando um valor muda (usado no atraso da busca);
// useCallback = guarda uma função para não recriá-la a cada redesenho.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, // rodinha de "carregando"
  FlatList,          // lista eficiente
  Modal,             // janela por cima da tela (formulário)
  Pressable,         // área clicável
  RefreshControl,    // "puxar para atualizar"
  ScrollView,        // área com rolagem
  StyleSheet,        // estilos
  Text,
  TextInput,         // campo de digitação
  View,              // caixa/contêiner
} from 'react-native';
// Executa algo toda vez que a tela fica visível.
import { useFocusEffect } from '@react-navigation/native';
// Função que chama o backend (envia o token e trata os erros).
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import Moldura from '../ui/Moldura';
// Máscaras de dinheiro (src/utils/formatos.js):
//   mascaraMoeda("890")         -> "R$ 8,90"  (enquanto digita)
//   moeda(8.9)                  -> "R$ 8,90"  (para mostrar)
//   moedaParaNumero("R$ 8,90")  -> 8.9        (para enviar) | "" -> NaN
//   numeroParaMascara(8.9)      -> "R$ 8,90"  (para preencher o formulário de edição)
import { mascaraMoeda, moeda, moedaParaNumero, numeroParaMascara } from '../utils/formatos';
import { cores } from '../ui/tema';

// ---------- Funções auxiliares ----------
// 15000 -> "15.000" (ponto a cada 3 dígitos)
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));

// A tela mostra a data como dd/mm/aaaa; a API recebe aaaa-mm-dd.
// padStart(2, '0') = completa com zero à esquerda (5 -> "05"). getMonth() começa em 0, por isso o +1.
const hoje = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
// "16/11/2026" -> "2026-11-16". Se o texto não estiver no formato, devolve null.
// A expressão regular captura dia (m[1]), mês (m[2]) e ano (m[3]).
const paraISO = (texto) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

// Mensagem amigável: servidor desligado ou a mensagem que o backend mandou.
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

// Filtro de período: [valor enviado à API, texto do botão]. 0 = tudo.
const PERIODOS = [
  [0, 'Tudo'],
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
];
// Atalhos para o tipo de manutenção (o admin também pode digitar outro).
const TIPOS_MANUTENCAO = ['Troca de óleo', 'Pneus', 'Freios', 'Revisão'];

// Formulário em branco. Os campos de manutenção e de lavagem ficam juntos;
// cada aba usa só os seus.
const formVazio = () => ({
  caminhao_id: null,
  data: hoje(),
  observacao: '',   // lavagem
  tipo: '',         // manutenção
  descricao: '',    // manutenção
  valor: '',        // manutenção (vazio = R$ 0,00)
  km: '',           // manutenção
  nf_numero: '',    // nota fiscal (opcional, só no cadastro)
  nf_fornecedor: '',
  nf_chave_acesso: '',
});

// ---------- Componentes pequenos ----------
// Campo de texto com rótulo. "...props" repassa value, onChangeText etc. para o TextInput.
function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
    </View>
  );
}

// Botão de escolha (caminhão e tipo de manutenção). "ativo" = escolhido (fica vermelho).
function Opcao({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.opcao, ativo && styles.opcaoAtiva]}>
      <Text style={[styles.opcaoTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

// Botão redondinho do filtro de período.
function Chip({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.chip, ativo && styles.chipAtivo]}>
      <Text style={[styles.chipTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

// ---------- A tela ----------
export default function Servicos() {
  const [aba, setAba] = useState('manutencoes'); // 'manutencoes' ou 'lavagens'
  const [itens, setItens] = useState([]);           // itens já carregados
  const [pagina, setPagina] = useState(1);          // página atual
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const [total, setTotal] = useState(0);            // quantos registros existem no filtro
  const [totalValor, setTotalValor] = useState(0);  // soma dos valores (só manutenções)
  const [caminhoes, setCaminhoes] = useState([]);   // para escolher o caminhão no cadastro

  const [busca, setBusca] = useState('');                 // o que está no campo de busca
  const [buscaAplicada, setBuscaAplicada] = useState(''); // o que realmente foi pesquisado
  const [dias, setDias] = useState(30);

  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null); // id do item esperando o 2º toque de excluir

  const [formAberto, setFormAberto] = useState(false);
  // editando: null = cadastrando um novo | objeto = alterando aquele item da lista
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);

  const ehManutencao = aba === 'manutencoes';

  // Só pesquisa 0,4 s depois que a pessoa para de digitar.
  // Cada letra reinicia o relógio (clearTimeout); assim não chamamos a API a cada letra.
  useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca.trim()), 400);
    return () => clearTimeout(timer);
  }, [busca]);

  // Busca uma página da lista. numeroPagina = 1 recomeça a lista; maior que 1 acrescenta no fim.
  const carregar = useCallback(
    async (numeroPagina = 1) => {
      try {
        setErro(null);
        // URLSearchParams monta "?pagina=1&dias=30&busca=..." já codificado para a URL.
        const params = new URLSearchParams({ pagina: String(numeroPagina), dias: String(dias) });
        if (buscaAplicada) params.set('busca', buscaAplicada);

        const r = await api(`/${aba}?${params.toString()}`);
        // Página 1 substitui a lista; as outras juntam no fim ("...atual" = os que já estavam).
        setItens((atual) => (numeroPagina === 1 ? r.dados : [...atual, ...r.dados]));
        setPagina(r.pagina);
        setUltimaPagina(r.ultima_pagina);
        setTotal(r.total);
        setTotalValor(r.total_valor ?? 0); // lavagens não têm total_valor
      } catch (e) {
        setErro('Não foi possível carregar a lista. Verifique se o servidor está ligado.');
      } finally {
        setCarregando(false);
        setCarregandoMais(false);
        setAtualizando(false);
      }
    },
    // Quando a aba, o período ou a busca mudam, "carregar" é recriada e o useFocusEffect recarrega.
    [aba, dias, buscaAplicada]
  );

  // Toda vez que a tela abre (ou um filtro muda): recarrega a lista e a lista de caminhões.
  useFocusEffect(
    useCallback(() => {
      setConfirmandoId(null);
      carregar(1);
      api('/caminhoes').then(setCaminhoes).catch(() => {});
    }, [carregar])
  );

  // Só caminhões com motorista responsável (o lançamento fica no nome dele).
  const caminhoesDisponiveis = caminhoes.filter((c) => c.motorista_id);

  // Muda um campo do formulário mantendo os outros.
  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  // "+ Novo": formulário vazio, modo cadastro.
  const abrirNovo = () => {
    setForm(formVazio());
    setEditando(null);
    setErroForm(null);
    setFormAberto(true);
  };

  // "Editar": formulário preenchido com os dados do item tocado, modo alteração.
  // A API já manda a data como dd/mm/aaaa, que é o formato do campo.
  const abrirEdicao = (item) => {
    setForm({
      ...formVazio(),
      data: item.data,
      observacao: item.observacao ?? '',
      tipo: item.tipo ?? '',
      descricao: item.descricao ?? '',
      // 0 vira "R$ 0,00"; numeroParaMascara(null) vira "".
      valor: numeroParaMascara(item.valor),
      km: item.km != null ? String(item.km) : '',
    });
    setEditando(item);
    setErroForm(null);
    setConfirmandoId(null);
    setFormAberto(true);
  };

  const fechar = () => {
    setFormAberto(false);
    setEditando(null);
  };

  // "Registrar" / "Salvar alterações".
  const salvar = async () => {
    const data = paraISO(form.data);
    // O caminhão só é escolhido no cadastro (na edição ele não muda).
    if (!editando && !form.caminhao_id) return setErroForm('Escolha o caminhão.');
    if (!data) return setErroForm('Informe a data no formato dd/mm/aaaa.');

    let corpo;
    if (ehManutencao) {
      // Campo de valor vazio = manutenção sem custo (R$ 0,00).
      // (A máscara de dinheiro apaga o zero digitado, por isso o vazio vale como zero.)
      const valor = form.valor === '' ? 0 : moedaParaNumero(form.valor);
      const km = Number(form.km);
      if (!form.tipo.trim()) return setErroForm('Informe o tipo de manutenção.');
      if (Number.isNaN(valor) || valor < 0) return setErroForm('Informe um valor válido.');
      if (form.km === '' || Number.isNaN(km)) return setErroForm('Informe a quilometragem.');
      corpo = {
        data,
        tipo: form.tipo.trim(),
        descricao: form.descricao.trim() || null, // texto vazio vira null
        valor,
        km,
      };
      // Caminhão e nota fiscal só vão no cadastro.
      if (!editando) {
        corpo.caminhao_id = form.caminhao_id;
        // Nota fiscal (opcional): vazio vira null.
        corpo.nf_numero = form.nf_numero.trim() || null;
        corpo.nf_fornecedor = form.nf_fornecedor.trim() || null;
        corpo.nf_chave_acesso = form.nf_chave_acesso.replace(/\D/g, '') || null;
      }
    } else {
      corpo = { data, observacao: form.observacao.trim() || null };
      if (!editando) corpo.caminhao_id = form.caminhao_id;
    }

    setSalvando(true);
    setErroForm(null);
    try {
      if (editando) {
        // Alteração: PUT /manutencoes/{id} ou /lavagens/{id}
        await api(`/${aba}/${editando.id}`, { metodo: 'PUT', corpo });
      } else {
        // Cadastro: POST /manutencoes ou /lavagens
        await api(`/${aba}`, { metodo: 'POST', corpo });
      }
      fechar();
      await carregar(1);
    } catch (e) {
      setErroForm(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id) => {
    // Primeiro toque: pede confirmação. Segundo toque: exclui.
    if (confirmandoId !== id) {
      setConfirmandoId(id);
      return;
    }
    try {
      await api(`/${aba}/${id}`, { metodo: 'DELETE' });
      setConfirmandoId(null);
      await carregar(1);
    } catch (e) {
      setErro(mensagemDe(e));
      setConfirmandoId(null);
    }
  };

  // Busca + período + resumo. Fica no topo da lista (ListHeaderComponent), rolando junto com ela.
  const filtros = (
    <View>
      <TextInput
        style={styles.busca}
        placeholder="Buscar por placa ou motorista"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.chips}>
        {PERIODOS.map(([valor, rotulo]) => (
          <Chip key={valor} texto={rotulo} ativo={dias === valor} aoTocar={() => setDias(valor)} />
        ))}
      </View>
      {/* Singular ou plural conforme o total (1 manutenção / 2 manutenções) */}
      <Text style={styles.resumo}>
        {ehManutencao
          ? `${total} ${total === 1 ? 'manutenção' : 'manutenções'} · ${moeda(totalValor)} no total`
          : `${total} ${total === 1 ? 'lavagem' : 'lavagens'}`}
      </Text>
    </View>
  );

  // Título do formulário conforme a aba e o modo.
  const tituloForm = editando
    ? ehManutencao ? 'Editar manutenção' : 'Editar lavagem'
    : ehManutencao ? 'Nova manutenção' : 'Nova lavagem';

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="LAVAGENS E MANUTENÇÕES">
        <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
          <Text style={styles.botaoNovoTexto}>+ Novo</Text>
        </Pressable>
      </Cabecalho>

      {/* Abas: ao trocar, limpa a lista e mostra a rodinha até a nova lista chegar */}
      <View style={styles.segmentos}>
        {[
          ['manutencoes', 'Manutenções'],
          ['lavagens', 'Lavagens'],
        ].map(([valor, rotulo]) => (
          <Pressable
            key={valor}
            onPress={() => {
              setCarregando(true);
              setItens([]);
              setAba(valor);
            }}
            style={[styles.segmento, aba === valor && styles.segmentoAtivo]}
          >
            <Text style={[styles.segmentoTexto, aba === valor && { color: '#fff' }]}>{rotulo}</Text>
          </Pressable>
        ))}
      </View>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      <FlatList
        data={itens}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={filtros}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => {
              setAtualizando(true);
              carregar(1);
            }}
          />
        }
        ListEmptyComponent={
          !carregando && !erro ? <Text style={styles.vazio}>Nenhum registro encontrado.</Text> : null
        }
        // "Carregar mais" só aparece se ainda houver páginas.
        ListFooterComponent={
          pagina < ultimaPagina ? (
            <Pressable
              style={styles.maisBotao}
              disabled={carregandoMais}
              onPress={() => {
                setCarregandoMais(true);
                carregar(pagina + 1);
              }}
            >
              {carregandoMais ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.maisTexto}>
                  Carregar mais ({itens.length} de {total})
                </Text>
              )}
            </Pressable>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.caixa}>
            <View style={styles.topo}>
              <Text style={styles.principal}>
                {ehManutencao ? `${item.placa} · ${item.tipo}` : `${item.placa} · Lavagem`}
              </Text>
              {/* Ações do item: Editar e Excluir (este pede um segundo toque) */}
              <View style={styles.acoes}>
                <Pressable onPress={() => abrirEdicao(item)} hitSlop={6}>
                  <Text style={styles.editar}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => excluir(item.id)} hitSlop={6}>
                  <Text style={[styles.excluir, confirmandoId === item.id && styles.excluirAtivo]}>
                    {confirmandoId === item.id ? 'Confirmar exclusão' : 'Excluir'}
                  </Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.detalhe}>
              {item.data} · {item.motorista}
            </Text>
            {ehManutencao && (
              <Text style={styles.valor}>
                {moeda(item.valor)} · {numero(item.km)} km
              </Text>
            )}
            {ehManutencao && item.descricao ? <Text style={styles.detalhe}>{item.descricao}</Text> : null}
            {ehManutencao && item.nota ? <Text style={styles.detalhe}>NF {item.nota}</Text> : null}
            {!ehManutencao && item.observacao ? <Text style={styles.detalhe}>{item.observacao}</Text> : null}
          </View>
        )}
      />

      {/* Formulário de cadastro e de edição (o mesmo para os dois modos) */}
      <Modal visible={formAberto} animationType="slide" onRequestClose={fechar}>
        <Moldura>
        <ScrollView style={styles.tela} contentContainerStyle={styles.formConteudo} keyboardShouldPersistTaps="handled">
          <Cabecalho titulo={tituloForm} aoVoltar={fechar} />

          {/* Caminhão: no cadastro escolhe; na edição só mostra (não pode ser trocado) */}
          <Text style={styles.rotulo}>Caminhão</Text>
          {editando ? (
            <Text style={styles.caminhaoFixo}>
              {editando.placa} · {editando.motorista}
            </Text>
          ) : (
            <View style={styles.opcoes}>
              {caminhoesDisponiveis.length === 0 && (
                <Text style={styles.detalhe}>Nenhum caminhão com motorista responsável.</Text>
              )}
              {caminhoesDisponiveis.map((c) => (
                <Opcao
                  key={c.id}
                  texto={c.placa}
                  ativo={form.caminhao_id === c.id}
                  // Ao escolher o caminhão, o km já vem preenchido com o km atual dele
                  // (se o campo ainda estiver vazio).
                  aoTocar={() =>
                    setForm((atual) => ({ ...atual, caminhao_id: c.id, km: atual.km || String(c.km_atual ?? '') }))
                  }
                />
              ))}
            </View>
          )}

          <Campo rotulo="Data (dd/mm/aaaa)" value={form.data} onChangeText={(v) => mudar('data', v)} maxLength={10} />

          {/* Campos de manutenção ou de lavagem, conforme a aba */}
          {ehManutencao ? (
            <>
              <Campo rotulo="Tipo de manutenção" value={form.tipo} onChangeText={(v) => mudar('tipo', v)} />
              <View style={styles.opcoes}>
                {TIPOS_MANUTENCAO.map((t) => (
                  <Opcao key={t} texto={t} ativo={form.tipo === t} aoTocar={() => mudar('tipo', t)} />
                ))}
              </View>
              <Campo
                rotulo="Descrição (opcional)"
                value={form.descricao}
                onChangeText={(v) => mudar('descricao', v)}
                multiline
              />
              <Campo
                rotulo="Valor (deixe vazio se não teve custo)"
                placeholder="R$ 0,00"
                value={form.valor}
                onChangeText={(v) => mudar('valor', mascaraMoeda(v))}
                keyboardType="numeric"
              />
              <Campo
                rotulo="Quilometragem do caminhão"
                value={form.km}
                onChangeText={(v) => mudar('km', v)}
                keyboardType="numeric"
              />

              {/* Nota fiscal: só no cadastro. Na edição aparece só o número, se tiver. */}
              {editando ? (
                editando.nota ? <Text style={styles.detalhe}>Nota fiscal: NF {editando.nota}</Text> : null
              ) : (
                <>
                  <Text style={styles.secaoForm}>Nota fiscal (opcional)</Text>
                  <Campo
                    rotulo="Número da nota"
                    value={form.nf_numero}
                    onChangeText={(v) => mudar('nf_numero', v)}
                    maxLength={20}
                  />
                  <Campo
                    rotulo="Oficina / fornecedor"
                    value={form.nf_fornecedor}
                    onChangeText={(v) => mudar('nf_fornecedor', v)}
                  />
                  <Campo
                    rotulo="Chave de acesso (44 números, opcional)"
                    value={form.nf_chave_acesso}
                    onChangeText={(v) => mudar('nf_chave_acesso', v.replace(/\D/g, '').slice(0, 44))}
                    keyboardType="numeric"
                    maxLength={44}
                  />
                </>
              )}
            </>
          ) : (
            <Campo
              rotulo="Observação (opcional)"
              value={form.observacao}
              onChangeText={(v) => mudar('observacao', v)}
            />
          )}

          {erroForm && <Text style={styles.erroForm}>{erroForm}</Text>}

          <Pressable style={[styles.botao, salvando && styles.desativado]} onPress={salvar} disabled={salvando}>
            {salvando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botaoTexto}>{editando ? 'Salvar alterações' : 'Registrar'}</Text>
            )}
          </Pressable>
          <Pressable style={styles.botaoSecundario} onPress={fechar} disabled={salvando}>
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>
        </ScrollView>
        </Moldura>
      </Modal>
    </View>
  );
}

// ---------- Estilos ----------
const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 16, paddingTop: 56 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: cores.texto, marginBottom: 12 },
  // Botão "+ Novo" dentro do cabeçalho vermelho
  botaoNovo: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
  // Abas Manutenções / Lavagens
  segmentos: { flexDirection: 'row', backgroundColor: cores.bordaClara, borderRadius: 8, padding: 3, marginBottom: 12 },
  segmento: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  segmentoAtivo: { backgroundColor: cores.primaria },
  segmentoTexto: { fontSize: 14, fontWeight: '600', color: cores.textoMedio },
  busca: { backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  // Filtro de período
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  chipTexto: { fontSize: 13, fontWeight: '600', color: cores.textoMedio },
  resumo: { fontSize: 13, color: cores.textoMedio, fontWeight: '600', marginBottom: 10 },
  erro: { color: cores.perigo, marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: cores.textoSecundario, marginTop: 40 },
  // Cartão de cada item
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  principal: { fontSize: 16, fontWeight: 'bold', color: cores.texto, flexShrink: 1, marginRight: 8 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 14 }, // Editar e Excluir lado a lado
  detalhe: { fontSize: 13, color: cores.textoSecundario, marginTop: 4 },
  valor: { fontSize: 13, color: cores.primaria, marginTop: 4, fontWeight: '600' },
  editar: { fontSize: 13, color: cores.primaria, fontWeight: '600' },
  excluir: { fontSize: 13, color: cores.textoSecundario, fontWeight: '600' },
  excluirAtivo: { color: cores.perigo },
  maisBotao: { borderWidth: 1, borderColor: cores.primaria, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  maisTexto: { color: cores.primaria, fontWeight: '600', fontSize: 15 },

  // ----- Formulário -----
  formConteudo: { paddingBottom: 40, width: '100%', maxWidth: 520, alignSelf: 'center' },
  grupo: { marginBottom: 12 },
  rotulo: { fontSize: 14, color: cores.textoMedio, marginBottom: 6, fontWeight: '500' },
  campo: { backgroundColor: '#fff', borderWidth: 1, borderColor: cores.borda, borderRadius: 8, padding: 12, fontSize: 16 },
  // Caminhão na edição: só texto (não dá para trocar)
  caminhaoFixo: { fontSize: 16, fontWeight: '600', color: cores.texto, marginBottom: 16 },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  opcao: {
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  opcaoAtiva: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: cores.textoMedio },
  erroForm: { color: cores.perigo, marginBottom: 12 },
  secaoForm: { fontSize: 16, fontWeight: '600', color: cores.texto, marginTop: 4, marginBottom: 10 },
  botao: { backgroundColor: cores.primaria, borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: cores.textoMedio, fontSize: 16, fontWeight: '600' },
});