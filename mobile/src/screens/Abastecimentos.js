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
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import SeletorLista from '../components/SeletorLista';
import EstadoVazio from '../ui/EstadoVazio';
import Esqueleto from '../ui/Esqueleto';
import MensagemErro from '../ui/MensagemErro';
import { useToast } from '../ui/Toast';
import {
  cartaoBase,
  RAIO_BOTAO,
  RAIO_CAMPO,
  sombraSuave,
  VERMELHO,
  VERMELHO_SUAVE,
  VERDE,
  TEXTO,
  TEXTO_SUAVE,
} from '../ui/tema';

// ABASTECIMENTO — lista filtrada + formulário (base) do admin.

const PASSO_LITROS = 50;

// ABASTECIMENTO FMT — funções de formatação.
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
  data: hoje()});

// Campo de texto com rótulo em cima.
function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
    </View>
  );
}

// Botão de filtro pequeno (lista).
function Chip({ texto, ativo, aoTocar }) {
  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [styles.chip, ativo && styles.chipAtivo, pressed && { opacity: 0.85 }]}
    >
      <Text style={[styles.chipTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

// Cartão de nível (atual ou projetado) — layout do print: litros grandes + % + barra.
function NivelTanque({ titulo, litros, capacidade, tom = 'atual', alerta = false }) {
  const pct = capacidade > 0 ? Math.min(100, (litros / capacidade) * 100) : null;
  const corBarra = alerta ? '#b91c1c' : tom === 'depois' ? VERDE : VERMELHO;

  return (
    <View style={styles.nivelCard} accessibilityRole="summary">
      <Text style={styles.nivelTitulo}>{titulo}</Text>
      <View style={styles.nivelTopo}>
        <Text style={[styles.nivelLitros, tom === 'depois' && !alerta && { color: VERDE }]}>
          {litrosFmt(litros)} L
        </Text>
        {pct != null ? (
          <Text style={[styles.nivelPct, tom === 'depois' && !alerta && { color: VERDE }]}>
            {pct.toFixed(0)}%
          </Text>
        ) : null}
      </View>
      {pct != null ? (
        <View style={styles.nivelBarraFundo}>
          <View style={[styles.nivelBarra, { width: `${pct}%`, backgroundColor: corBarra }]} />
        </View>
      ) : null}
    </View>
  );
}

// Stepper − / valor / + (print: Quantidade a abastecer).
function StepperLitros({ valor, aoMudar, maximo }) {
  const n = Number(String(valor).replace(',', '.'));
  const atual = Number.isFinite(n) && n > 0 ? n : 0;

  const aplicar = (prox) => {
    const limitado = Math.max(0, maximo != null ? Math.min(prox, maximo) : prox);
    aoMudar(limitado > 0 ? String(Math.round(limitado)) : '');
  };

  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>Quantidade a abastecer</Text>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => aplicar(atual - PASSO_LITROS)}
          style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.85 }]}
          accessibilityLabel="Diminuir litros"
        >
          <Text style={styles.stepperBtnTexto}>−</Text>
        </Pressable>
        <TextInput
          style={styles.stepperCampo}
          value={valor}
          onChangeText={aoMudar}
          keyboardType="decimal-pad"
          placeholder="0"
          textAlign="center"
        />
        <Pressable
          onPress={() => aplicar(atual + PASSO_LITROS)}
          style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.85 }]}
          accessibilityLabel="Aumentar litros"
        >
          <Text style={styles.stepperBtnTexto}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.stepperDica}>Passo de {PASSO_LITROS} L · ou digite o valor</Text>
    </View>
  );
}

// embutido: lista dentro de Gestão de Tanques (sem cabeçalho próprio / formulário de novo).
// ABASTECIMENTO
export default function Abastecimentos({ embutido = false }) {
  const toast = useToast();
  const [abastecimentos, setAbastecimentos] = useState([]); // itens já carregados (acumulam ao "carregar mais")
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const [total, setTotal] = useState(0);                    // quantos abastecimentos passam pelo filtro
  const [totalLitros, setTotalLitros] = useState(0);        // litros de todos eles
  const [caminhoes, setCaminhoes] = useState([]);           // usados no formulário
  const [tanques, setTanques] = useState([]);               // usados no formulário e no filtro

  // ABASTECIMENTO FILTROS
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
  const [erroForm, setErroForm] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null); // item que aguarda o segundo toque para excluir
  const [resumoOk, setResumoOk] = useState(null); // sucesso pós-confirmação (print)

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
        setErro('Não foi possível carregar os abastecimentos. Verifique a conexão e se o servidor está ligado.');
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

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  // Ao escolher o caminhão, já sugere a quilometragem atual dele.
  const escolherCaminhao = (id) => {
    const c = caminhoesDisponiveis.find((x) => x.id === id);
    setForm((atual) => ({
      ...atual,
      caminhao_id: id,
      km: c ? String(c.km_atual) : atual.km}));
  };

  const opcoesCaminhao = caminhoesDisponiveis.map((c) => ({
    valor: c.id,
    rotulo: `${c.placa} · ${c.modelo}${c.motorista?.nome ? ` · ${c.motorista.nome}` : ''}`}));

  const opcoesTanque = tanques.map((t) => ({
    valor: t.id,
    rotulo: `${t.nome} · ${t.tipo_combustivel} (${litrosFmt(t.nivel_atual)} L)`}));

  const opcoesTanqueFiltro = [
    { valor: null, rotulo: 'Todos os tanques' },
    ...tanques.map((t) => ({ valor: t.id, rotulo: t.nome })),
  ];

  const tanqueForm = tanques.find((t) => t.id === form.tanque_id);
  const caminhaoForm = caminhoesDisponiveis.find((c) => c.id === form.caminhao_id);
  const litrosForm = Number(String(form.litros).replace(',', '.'));
  const nivelAtual = tanqueForm ? Number(tanqueForm.nivel_atual) || 0 : 0;
  const capacidadeTanque = tanqueForm ? Number(tanqueForm.capacidade) || 0 : 0;
  const nivelDepois = Math.max(0, nivelAtual - (litrosForm > 0 ? litrosForm : 0));
  const insuficiente = litrosForm > 0 && litrosForm > nivelAtual;

  const ultimoDoCaminhao = form.caminhao_id
    ? abastecimentos.find((a) => a.caminhao?.id === form.caminhao_id || a.caminhao_id === form.caminhao_id)
    : null;

  const abrirNovo = () => {
    setForm(formVazio());
    setErroForm(null);
    setResumoOk(null);
    setFormAberto(true);
  };

  const fechar = () => {
    setFormAberto(false);
    setErroForm(null);
    setResumoOk(null);
  };

  const salvar = async () => {
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

    setSalvando(true);
    setErroForm(null);
    try {
      await api('/abastecimentos', {
        metodo: 'POST',
        corpo: { caminhao_id: form.caminhao_id, tanque_id: form.tanque_id, litros, km, data }});
      setResumoOk({
        placa: caminhaoForm?.placa ?? '—',
        modelo: caminhaoForm?.modelo ?? '',
        tanque: tanqueForm?.nome ?? '—',
        litros,
        nivelAntes: nivelAtual,
        nivelDepois: Math.max(0, nivelAtual - litros),
        data: form.data,
        km});
      toast.sucesso('Abastecimento registrado.');
      carregarApoio();
      await carregarLista(1);
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
      await api(`/abastecimentos/${id}`, { metodo: 'DELETE' });
      setConfirmandoId(null);
      toast.sucesso('Abastecimento excluído.');
      carregarApoio();
      await carregarLista(1);
    } catch (e) {
      setErro(mensagemDe(e));
      toast.erro(mensagemDe(e));
      setConfirmandoId(null);
    }
  };

  // Parte de cima da lista: busca, período, tanque e resumo do filtro.
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

      <Text style={styles.filtroRotulo}>Período</Text>
      <View style={styles.chips}>
        {PERIODOS.map(([valor, rotulo]) => (
          <Chip key={valor} texto={rotulo} ativo={dias === valor} aoTocar={() => setDias(valor)} />
        ))}
      </View>

      <SeletorLista
        rotulo="Tanque"
        valor={tanqueFiltro}
        opcoes={opcoesTanqueFiltro}
        aoMudar={setTanqueFiltro}
        placeholder="Todos os tanques"
        placeholderBusca="Buscar tanque…"
        vazio="Nenhum tanque cadastrado."
        comBusca={tanques.length > 4}
      />

      <View style={styles.resumoCaixa}>
        <Text style={styles.resumoValor}>
          {total} {total === 1 ? 'abastecimento' : 'abastecimentos'}
        </Text>
        <Text style={styles.resumoMeta}>{litrosFmt(totalLitros)} L no total</Text>
      </View>
    </View>
  );

  return (
    <View style={embutido ? styles.raiz : styles.tela}>
      {!embutido && (
        <Cabecalho titulo="Abastecer">
          <Pressable
            style={({ pressed }) => [styles.botaoNovo, pressed && { opacity: 0.85 }]}
            onPress={abrirNovo}
          >
            <Text style={styles.botaoNovoTexto}>+ Novo</Text>
          </Pressable>
        </Cabecalho>
      )}

      <View style={embutido ? styles.raiz : styles.corpo}>
        {embutido && (
          <View style={styles.cabecalhoEmbutido}>
            <Text style={styles.subtitulo}>Últimas abastecidas</Text>
          </View>
        )}

        {erro && (
          <MensagemErro
            titulo="Erro ao carregar abastecimentos"
            mensagem={erro}
            aoTentar={() => {
              setCarregando(true);
              carregarLista(1);
            }}
          />
        )}
        {carregando && !erro && (
          <>
            {filtros}
            <Esqueleto linhas={4} />
          </>
        )}

        {!carregando && (
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
                tintColor="#dc2626"
              />
            }
            ListEmptyComponent={
              !erro ? (
                <EstadoVazio
                  icone="gas-station-outline"
                  titulo={
                    buscaAplicada || tanqueFiltro
                      ? 'Nenhum abastecimento neste filtro'
                      : 'Nenhum abastecimento no período'
                  }
                  dica={
                    embutido
                      ? 'Quando houver saídas neste tanque, elas aparecem aqui.'
                      : 'Toque em + Novo para registrar um abastecimento.'
                  }
                />
              ) : null
            }
            ListFooterComponent={
              pagina < ultimaPagina ? (
                <Pressable
                  style={({ pressed }) => [styles.maisBotao, pressed && { opacity: 0.85 }]}
                  disabled={carregandoMais}
                  onPress={() => {
                    setCarregandoMais(true);
                    carregarLista(pagina + 1);
                  }}
                >
                  {carregandoMais ? (
                    <ActivityIndicator color="#dc2626" />
                  ) : (
                    <Text style={styles.maisTexto}>
                      Carregar mais ({abastecimentos.length} de {total})
                    </Text>
                  )}
                </Pressable>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 88 }}
            renderItem={({ item }) => (
              <View style={styles.caixa}>
                <View style={styles.topo}>
                  <Text style={styles.principal}>
                    {item.caminhao.placa} · {litrosFmt(item.litros)} L
                  </Text>
                  <Pressable
                    onPress={() => excluir(item.id)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.excluirBtn, pressed && { opacity: 0.75 }]}
                  >
                    <Text style={[styles.excluir, confirmandoId === item.id && styles.excluirAtivo]}>
                      {confirmandoId === item.id ? 'Confirmar' : 'Excluir'}
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
                    ? `${consumoFmt(item.consumo_km_l)} km/L · ${numero(item.km_rodados)} km desde o anterior`
                    : 'Consumo: sem registro anterior para comparar'}
                </Text>
              </View>
            )}
          />
        )}
      </View>

      {/* Formulário alinhado ao print: caminhão → nível → stepper → projetado → confirmar */}
      {!embutido && (
        <Modal visible={formAberto} animationType="slide" onRequestClose={fechar}>
          <ScrollView
            style={styles.tela}
            contentContainerStyle={styles.formConteudo}
            keyboardShouldPersistTaps="handled"
          >
            <Cabecalho
              titulo={resumoOk ? 'Abastecimento ok' : 'Abastecer caminhão'}
              aoVoltar={fechar}
              sangrar
            />

            {resumoOk ? (
              <View style={styles.sucessoCard}>
                <Text style={styles.sucessoTitulo}>Abastecimento confirmado</Text>
                <Text style={styles.sucessoPlaca}>
                  {resumoOk.placa}
                  {resumoOk.modelo ? ` · ${resumoOk.modelo}` : ''}
                </Text>
                <Text style={styles.sucessoLinha}>
                  {litrosFmt(resumoOk.litros)} L · {resumoOk.tanque}
                </Text>
                <Text style={styles.sucessoLinha}>
                  Estoque: {litrosFmt(resumoOk.nivelAntes)} L → {litrosFmt(resumoOk.nivelDepois)} L
                </Text>
                <Text style={styles.sucessoMeta}>
                  {resumoOk.data} · {numero(resumoOk.km)} km
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.botao, pressed && styles.botaoPressionado]}
                  onPress={fechar}
                >
                  <Text style={styles.botaoTexto}>Concluir</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <SeletorLista
                  rotulo="Selecione o caminhão"
                  valor={form.caminhao_id}
                  opcoes={opcoesCaminhao}
                  aoMudar={escolherCaminhao}
                  placeholder="Escolher caminhão…"
                  placeholderBusca="Buscar placa ou motorista…"
                  vazio="Nenhum caminhão ativo com motorista responsável."
                />

                <SeletorLista
                  rotulo="Tanque de origem"
                  valor={form.tanque_id}
                  opcoes={opcoesTanque}
                  aoMudar={(id) => mudar('tanque_id', id)}
                  placeholder="Escolher tanque…"
                  placeholderBusca="Buscar tanque…"
                  vazio="Nenhum tanque cadastrado."
                />

                {tanqueForm ? (
                  <NivelTanque
                    titulo="Nível atual do tanque"
                    litros={nivelAtual}
                    capacidade={capacidadeTanque}
                    tom="atual"
                  />
                ) : null}

                <StepperLitros
                  valor={form.litros}
                  aoMudar={(v) => mudar('litros', v)}
                  maximo={tanqueForm ? nivelAtual : undefined}
                />

                {tanqueForm && litrosForm > 0 ? (
                  <>
                    <NivelTanque
                      titulo="Nível após abastecimento"
                      litros={nivelDepois}
                      capacidade={capacidadeTanque}
                      tom="depois"
                      alerta={insuficiente}
                    />
                    {insuficiente ? (
                      <Text style={styles.previaAlerta}>
                        Litros acima do nível atual — a API vai recusar.
                      </Text>
                    ) : null}
                  </>
                ) : null}

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

                <Pressable
                  style={({ pressed }) => [
                    styles.botao,
                    salvando && styles.desativado,
                    pressed && !salvando && styles.botaoPressionado,
                  ]}
                  onPress={salvar}
                  disabled={salvando}
                >
                  {salvando ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.botaoTexto}>Confirmar abastecimento</Text>
                  )}
                </Pressable>

                {ultimoDoCaminhao ? (
                  <Text style={styles.ultimoRodape}>
                    Último abastecimento: {dataBR(ultimoDoCaminhao.data)}
                    {ultimoDoCaminhao.litros != null
                      ? ` · ${litrosFmt(ultimoDoCaminhao.litros)} L`
                      : ''}
                  </Text>
                ) : (
                  <Text style={styles.ultimoRodape}>Último abastecimento: sem registro na lista</Text>
                )}

                <Pressable style={styles.botaoSecundario} onPress={fechar} disabled={salvando}>
                  <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  tela: { flex: 1, backgroundColor: '#f3f4f6' },
  corpo: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  cabecalhoEmbutido: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12},
  subtitulo: { fontSize: 16, fontWeight: '600', color: '#374151' },
  botaoNovo: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)'},
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 14 },
  filtros: { marginBottom: 4 },
  busca: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CAMPO,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    outlineStyle: 'none',
    ...sombraSuave},
  filtroRotulo: { fontSize: 12, fontWeight: '600', color: TEXTO_SUAVE, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, ...sombraSuave},
  chipAtivo: { backgroundColor: VERMELHO },
  chipTexto: { fontSize: 13, fontWeight: '600', color: '#374151' },
  resumoCaixa: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CAMPO,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    ...sombraSuave},
  resumoValor: { fontSize: 14, fontWeight: '700', color: TEXTO },
  resumoMeta: { fontSize: 12, color: TEXTO_SUAVE, marginTop: 2 },
  caixa: { ...cartaoBase },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  principal: { flex: 1, fontSize: 16, fontWeight: '700', color: TEXTO },
  detalhe: { fontSize: 13, color: TEXTO_SUAVE, marginTop: 4 },
  consumo: { fontSize: 13, color: VERMELHO, marginTop: 6, fontWeight: '500' },
  excluirBtn: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#f3f4f6'},
  excluir: { fontSize: 12, color: TEXTO_SUAVE, fontWeight: '600' },
  excluirAtivo: { color: VERMELHO },
  maisBotao: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CAMPO,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
    ...sombraSuave},
  maisTexto: { color: VERMELHO, fontWeight: '600', fontSize: 15 },
  formConteudo: { paddingBottom: 40, paddingHorizontal: 16, width: '100%', maxWidth: 520, alignSelf: 'center'},
  grupo: { marginBottom: 12 },
  rotulo: { fontSize: 14, color: '#374151', marginBottom: 6, fontWeight: '500' },
  campo: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: RAIO_CAMPO,
    padding: 12,
    fontSize: 16},
  nivelCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, ...sombraSuave},
  nivelTitulo: { fontSize: 13, fontWeight: '600', color: TEXTO_SUAVE, marginBottom: 6 },
  nivelTopo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8},
  nivelLitros: { fontSize: 28, fontWeight: '800', color: TEXTO },
  nivelPct: { fontSize: 16, fontWeight: '700', color: TEXTO_SUAVE },
  nivelBarraFundo: { height: 10, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden'},
  nivelBarra: { height: 10, borderRadius: 5 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    ...sombraSuave},
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: VERMELHO_SUAVE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
    flexShrink: 0},
  stepperBtnTexto: { fontSize: 26, fontWeight: '700', color: VERMELHO, marginTop: -2 },
  stepperCampo: {
    flex: 1,
    minWidth: 0,
    fontSize: 28,
    fontWeight: '800',
    color: TEXTO,
    paddingVertical: 8,
    paddingHorizontal: 8,
    outlineStyle: 'none'},
  stepperDica: { fontSize: 12, color: TEXTO_SUAVE, marginTop: 6 },
  previaAlerta: { fontSize: 12, color: VERMELHO, fontWeight: '600', marginBottom: 10 },
  ultimoRodape: { textAlign: 'center', fontSize: 12, color: TEXTO_SUAVE, marginTop: 12},
  sucessoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginTop: 8, ...sombraSuave},
  sucessoTitulo: { fontSize: 18, fontWeight: '800', color: VERDE, marginBottom: 8 },
  sucessoPlaca: { fontSize: 20, fontWeight: '800', color: TEXTO, marginBottom: 6 },
  sucessoLinha: { fontSize: 15, color: TEXTO, marginBottom: 4 },
  sucessoMeta: { fontSize: 13, color: TEXTO_SUAVE, marginBottom: 18, marginTop: 4 },
  erroForm: { color: VERMELHO, marginBottom: 12 },
  botao: { backgroundColor: VERMELHO, borderRadius: RAIO_BOTAO, padding: 16, alignItems: 'center', marginTop: 4},
  botaoPressionado: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: '#374151', fontSize: 16, fontWeight: '600' }});
