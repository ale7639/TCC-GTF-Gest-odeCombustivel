import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import SeletorCaminhao from '../components/SeletorCaminhao';
import Moldura from '../ui/Moldura';
import { cores } from '../ui/tema';

// Funções de formatação.
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));                 // 15000 -> "15.000"
const litrosFmt = (n) => {                                            // "273.50" -> "273,5"
  const [inteiro, decimal] = String(Number(n)).split('.');
  return separar(inteiro) + (decimal ? `,${decimal}` : '');
};
const consumoFmt = (n) => String(n).replace('.', ',');               // 3.25 -> "3,25"
const moeda = (n) => 'R$ ' + separar(Number(n).toFixed(2).replace('.', ','));
const moedaL = (n) => 'R$ ' + Number(n).toFixed(2).replace('.', ',') + '/L';
const dataBR = (d) => d.slice(0, 10).split('-').reverse().join('/');  // "2026-10-16..." -> "16/10/2026"

// A tela mostra a data como dd/mm/aaaa; a API recebe aaaa-mm-dd.
const hoje = () => {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
};
const paraISO = (texto) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

// Mensagem amigável para qualquer erro de comunicação com a API.
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

// Períodos do filtro (0 = sem limite de data).
const PERIODOS = [
  [0, 'Tudo'],
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
];

// Formulário em branco para um abastecimento novo.
const formVazio = () => ({
  caminhao_id: null,
  tanque_id: null,
  litros: '',
  km: '',
  data: hoje(),
});

// Campo de texto com rótulo em cima.
function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
    </View>
  );
}

// Botão de escolha grande (formulário).
function Opcao({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.opcao, ativo && styles.opcaoAtiva]}>
      <Text style={[styles.opcaoTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

// Botão de filtro pequeno (lista).
function Chip({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.chip, ativo && styles.chipAtivo]}>
      <Text style={[styles.chipTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

// Uma linha "rótulo ........ valor" do resumo de confirmação.
function LinhaResumo({ rotulo, valor }) {
  return (
    <View style={styles.linhaResumo}>
      <Text style={styles.linhaResumoRotulo}>{rotulo}</Text>
      <Text style={styles.linhaResumoValor}>{valor}</Text>
    </View>
  );
}

export default function Abastecimentos() {
  const [abastecimentos, setAbastecimentos] = useState([]); // itens já carregados (acumulam ao "carregar mais")
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const [total, setTotal] = useState(0);                    // quantos abastecimentos passam pelo filtro
  const [totalLitros, setTotalLitros] = useState(0);        // litros de todos eles
  const [caminhoes, setCaminhoes] = useState([]);           // usados no formulário
  const [tanques, setTanques] = useState([]);               // usados no formulário e no filtro

  // Filtros da lista.
  const [busca, setBusca] = useState('');                   // o que está sendo digitado
  const [buscaAplicada, setBuscaAplicada] = useState('');   // o que de fato vai para a API (após uma pausa)
  const [tanqueFiltro, setTanqueFiltro] = useState(null);
  const [dias, setDias] = useState(30);

  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);

  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [confirmacao, setConfirmacao] = useState(null); // resumo mostrado antes de gravar
  const [erroForm, setErroForm] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null); // item que aguarda o segundo toque para excluir

  // Só pesquisa 0,4 s depois que a pessoa para de digitar (evita uma chamada a cada letra).
  useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca.trim()), 400);
    return () => clearTimeout(timer);
  }, [busca]);

  // Busca uma página da lista com os filtros atuais.
  const carregarLista = useCallback(
    async (numeroPagina = 1) => {
      try {
        setErro(null);
        const params = new URLSearchParams({ pagina: String(numeroPagina), dias: String(dias) });
        if (buscaAplicada) params.set('busca', buscaAplicada);
        if (tanqueFiltro) params.set('tanque_id', String(tanqueFiltro));

        const resposta = await api(`/abastecimentos?${params.toString()}`);
        setAbastecimentos((atual) =>
          numeroPagina === 1 ? resposta.dados : [...atual, ...resposta.dados]
        );
        setPagina(resposta.pagina);
        setUltimaPagina(resposta.ultima_pagina);
        setTotal(resposta.total);
        setTotalLitros(resposta.total_litros);
      } catch (e) {
        setErro('Não foi possível carregar os abastecimentos. Verifique se o servidor está ligado.');
      } finally {
        setCarregando(false);
        setCarregandoMais(false);
        setAtualizando(false);
      }
    },
    [dias, buscaAplicada, tanqueFiltro]
  );

  // Caminhões e tanques (para o formulário e para os botões de filtro).
  const carregarApoio = useCallback(async () => {
    try {
      const [listaCaminhoes, listaTanques] = await Promise.all([api('/caminhoes'), api('/tanques')]);
      setCaminhoes(listaCaminhoes);
      setTanques(listaTanques);
    } catch (e) {
      // Se falhar, a lista principal já mostra o aviso de conexão.
    }
  }, []);

  // Recarrega ao abrir a aba e sempre que um filtro mudar.
  useFocusEffect(
    useCallback(() => {
      carregarApoio();
      carregarLista(1);
    }, [carregarApoio, carregarLista])
  );

  // Só caminhões ativos e com motorista responsável podem ser abastecidos.
  const caminhoesDisponiveis = caminhoes.filter((c) => c.status === 'ativo' && c.motorista_id);

  // Qualquer mudança no formulário cancela o resumo (precisa conferir de novo).
  const mudar = (campo, valor) => {
    setConfirmacao(null);
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  // Ao escolher o caminhão, já sugere a quilometragem atual dele.
  const escolherCaminhao = (c) => {
    setConfirmacao(null);
    setForm((atual) => ({ ...atual, caminhao_id: c.id, km: String(c.km_atual) }));
  };

  const abrirNovo = () => {
    setForm(formVazio());
    setErroForm(null);
    setConfirmacao(null);
    setFormAberto(true);
  };

  const fechar = () => {
    setFormAberto(false);
    setErroForm(null);
    setConfirmacao(null);
  };

  // Veio do botão "Abastecer caminhão" do Painel: já abre o formulário.
  const rota = useRoute();
  useEffect(() => {
    if (rota.params?.novo) abrirNovo();
  }, [rota.params?.novo]);

  // Veio de um cartão do Relatório: aplica a placa, o período e o tanque que estavam lá.
  useEffect(() => {
    const f = rota.params?.filtro;
    if (!f) return;
    setBusca(f.busca ?? '');
    setBuscaAplicada(f.busca ?? ''); // aplica na hora, sem esperar a pausa de digitação
    setDias(f.dias ?? 30);
    setTanqueFiltro(f.tanqueId ?? null);
  }, [rota.params?.filtro]);

  // Passo 1 ("Registrar"): confere os campos e mostra o resumo para o usuário confirmar.
  const revisar = () => {
    const litros = Number(String(form.litros).replace(',', '.'));
    const km = Number(form.km);
    const data = paraISO(form.data);

    if (!form.caminhao_id || !form.tanque_id) {
      setErroForm('Escolha o caminhão e o tanque.');
      return;
    }
    if (!(litros > 0)) {
      setErroForm('Informe a quantidade de litros.');
      return;
    }
    if (form.km === '' || Number.isNaN(km)) {
      setErroForm('Informe a quilometragem.');
      return;
    }
    if (!data) {
      setErroForm('Informe a data no formato dd/mm/aaaa.');
      return;
    }

    const caminhao = caminhoes.find((c) => c.id === form.caminhao_id);
    const tanque = tanques.find((t) => t.id === form.tanque_id);
    const custoMedio = tanque?.custo_medio != null ? Number(tanque.custo_medio) : null;

    setErroForm(null);
    setConfirmacao({
      corpo: { caminhao_id: form.caminhao_id, tanque_id: form.tanque_id, litros, km, data },
      caminhao: caminhao ? `${caminhao.placa} · ${caminhao.motorista?.nome ?? ''}` : '',
      tanque: tanque ? tanque.nome : '',
      litros,
      km,
      data: form.data,
      sobraNoTanque: tanque ? Number(tanque.nivel_atual) - litros : null,
      custoEstimado: custoMedio != null ? litros * custoMedio : null,
    });
  };

  // Passo 2 ("Confirmar abastecimento"): grava de verdade.
  const confirmar = async () => {
    setSalvando(true);
    setErroForm(null);
    try {
      await api('/abastecimentos', { metodo: 'POST', corpo: confirmacao.corpo });
      fechar();
      carregarApoio();
      await carregarLista(1);
    } catch (e) {
      setErroForm(mensagemDe(e));
      setConfirmacao(null); // volta ao formulário para corrigir o que o servidor recusou
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
      await api(`/abastecimentos/${id}`, { metodo: 'DELETE' });
      setConfirmandoId(null);
      carregarApoio();
      await carregarLista(1);
    } catch (e) {
      setErro(mensagemDe(e));
      setConfirmandoId(null);
    }
  };

  // Parte de cima da lista: busca, filtros e o resumo do que está filtrado.
  const filtros = (
    <View style={styles.filtros}>
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

      <View style={styles.chips}>
        <Chip texto="Todos os tanques" ativo={tanqueFiltro === null} aoTocar={() => setTanqueFiltro(null)} />
        {tanques.map((t) => (
          <Chip
            key={t.id}
            texto={t.nome}
            ativo={tanqueFiltro === t.id}
            aoTocar={() => setTanqueFiltro(t.id)}
          />
        ))}
      </View>

      <Text style={styles.resumo}>
        {total} {total === 1 ? 'abastecimento' : 'abastecimentos'} · {litrosFmt(totalLitros)} L no total
      </Text>
    </View>
  );

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="ABASTECIMENTOS">
        <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
          <Text style={styles.botaoNovoTexto}>+ Novo</Text>
        </Pressable>
      </Cabecalho>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      <FlatList
        data={abastecimentos}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={filtros}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => {
              setAtualizando(true);
              carregarApoio();
              carregarLista(1);
            }}
          />
        }
        ListEmptyComponent={
          !carregando && !erro ? (
            <Text style={styles.vazio}>Nenhum abastecimento encontrado.</Text>
          ) : null
        }
        ListFooterComponent={
          pagina < ultimaPagina ? (
            <Pressable
              style={styles.maisBotao}
              disabled={carregandoMais}
              onPress={() => {
                setCarregandoMais(true);
                carregarLista(pagina + 1);
              }}
            >
              {carregandoMais ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.maisTexto}>
                  Carregar mais ({abastecimentos.length} de {total})
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
                {item.caminhao.placa} · {litrosFmt(item.litros)} L
              </Text>
              <Pressable onPress={() => excluir(item.id)}>
                <Text style={[styles.excluir, confirmandoId === item.id && styles.excluirAtivo]}>
                  {confirmandoId === item.id ? 'Confirmar exclusão' : 'Excluir'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.detalhe}>
              {item.motorista.nome} ·{' '}
              {item.tanque ? item.tanque.nome : `Fora da base · ${item.posto ?? 'posto'}`}
            </Text>
            <Text style={styles.detalhe}>
              {dataBR(item.data)} · {numero(item.km)} km
            </Text>
            {item.nota_numero ? <Text style={styles.detalhe}>NF {item.nota_numero}</Text> : null}
            {item.custo_litro != null && (
              <Text style={styles.detalhe}>
                Custo: {moedaL(item.custo_litro)} · total {moeda(item.custo_total)}
              </Text>
            )}
            <Text style={styles.consumo}>
              {item.consumo_km_l != null
                ? `${consumoFmt(item.consumo_km_l)} km/L · ${numero(item.km_rodados)} km desde o abastecimento anterior`
                : 'Consumo: sem abastecimento anterior para comparar'}
            </Text>
          </View>
        )}
      />

      {/* Formulário de novo abastecimento */}
      <Modal visible={formAberto} animationType="slide" onRequestClose={fechar}>
        <Moldura>
        <ScrollView
          style={styles.tela}
          contentContainerStyle={styles.formConteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Cabecalho titulo="Novo abastecimento" aoVoltar={fechar} />

          <Text style={styles.rotulo}>Caminhão</Text>
          <SeletorCaminhao
            caminhoes={caminhoesDisponiveis}
            selecionadoId={form.caminhao_id}
            aoEscolher={escolherCaminhao}
            vazio="Nenhum caminhão ativo com motorista responsável."
          />

          <Text style={styles.rotulo}>Tanque de origem</Text>
          <View style={styles.opcoes}>
            {tanques.map((t) => (
              <Opcao
                key={t.id}
                texto={`${t.nome} · ${t.tipo_combustivel} (${litrosFmt(t.nivel_atual)} L)`}
                ativo={form.tanque_id === t.id}
                aoTocar={() => mudar('tanque_id', t.id)}
              />
            ))}
          </View>

          <Campo
            rotulo="Litros"
            value={form.litros}
            onChangeText={(v) => mudar('litros', v)}
            keyboardType="decimal-pad"
          />
          <Campo
            rotulo="Quilometragem do caminhão"
            value={form.km}
            onChangeText={(v) => mudar('km', v)}
            keyboardType="numeric"
          />
          <Campo
            rotulo="Data (dd/mm/aaaa)"
            value={form.data}
            onChangeText={(v) => mudar('data', v)}
            maxLength={10}
          />

          {erroForm && <Text style={styles.erroForm}>{erroForm}</Text>}

          {!confirmacao ? (
            <>
              <Pressable style={styles.botao} onPress={revisar}>
                <Text style={styles.botaoTexto}>Registrar</Text>
              </Pressable>
              <Pressable style={styles.botaoSecundario} onPress={fechar}>
                <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.confirmacao}>
              <Text style={styles.confirmacaoTitulo}>Confirme o abastecimento</Text>
              <LinhaResumo rotulo="Caminhão" valor={confirmacao.caminhao} />
              <LinhaResumo rotulo="Tanque" valor={confirmacao.tanque} />
              <LinhaResumo rotulo="Litros" valor={`${litrosFmt(confirmacao.litros)} L`} />
              <LinhaResumo rotulo="Quilometragem" valor={`${numero(confirmacao.km)} km`} />
              <LinhaResumo rotulo="Data" valor={confirmacao.data} />
              {confirmacao.sobraNoTanque != null && (
                <LinhaResumo rotulo="Tanque fica com" valor={`${litrosFmt(Math.max(0, confirmacao.sobraNoTanque))} L`} />
              )}
              {confirmacao.custoEstimado != null && (
                <LinhaResumo rotulo="Custo estimado" valor={moeda(confirmacao.custoEstimado)} />
              )}

              <Pressable
                style={[styles.botao, { marginTop: 12 }, salvando && styles.desativado]}
                onPress={confirmar}
                disabled={salvando}
              >
                {salvando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botaoTexto}>Confirmar abastecimento</Text>
                )}
              </Pressable>
              <Pressable style={styles.botaoSecundario} onPress={() => setConfirmacao(null)} disabled={salvando}>
                <Text style={styles.botaoSecundarioTexto}>Voltar e corrigir</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
        </Moldura>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 16, paddingTop: 56 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: cores.texto, marginBottom: 4 },
  botaoNovo: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },

  filtros: { marginBottom: 4 },
  busca: { backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
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
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  principal: { fontSize: 17, fontWeight: 'bold', color: cores.texto },
  detalhe: { fontSize: 13, color: cores.textoSecundario, marginTop: 4 },
  consumo: { fontSize: 13, color: cores.primaria, marginTop: 4, fontWeight: '500' },
  excluir: { fontSize: 13, color: cores.textoSecundario, fontWeight: '600' },
  excluirAtivo: { color: cores.perigo },
  maisBotao: {
    borderWidth: 1,
    borderColor: cores.primaria,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  maisTexto: { color: cores.primaria, fontWeight: '600', fontSize: 15 },

  formConteudo: { paddingBottom: 40, width: '100%', maxWidth: 520, alignSelf: 'center' },
  grupo: { marginBottom: 12 },
  rotulo: { fontSize: 14, color: cores.textoMedio, marginBottom: 6, fontWeight: '500' },
  campo: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
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
  aviso: { color: cores.textoSecundario },
  erroForm: { color: cores.perigo, marginBottom: 12 },
  botao: { backgroundColor: cores.primaria, borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: cores.textoMedio, fontSize: 16, fontWeight: '600' },
  confirmacao: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: cores.primaria,
    borderRadius: 12,
    padding: 14,
  },
  confirmacaoTitulo: { fontSize: 16, fontWeight: 'bold', color: cores.primaria, marginBottom: 8 },
  linhaResumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: cores.bordaClara,
    gap: 12,
  },
  linhaResumoRotulo: { fontSize: 14, color: cores.textoSecundario },
  linhaResumoValor: { fontSize: 14, fontWeight: '600', color: cores.texto, flexShrink: 1, textAlign: 'right' },
});