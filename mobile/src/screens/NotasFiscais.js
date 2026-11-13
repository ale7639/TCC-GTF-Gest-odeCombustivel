import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import SeletorLista from '../components/SeletorLista';
import { useToast } from '../ui/Toast';
import { baixarArquivo } from '../utils/baixarArquivo';
import { mascaraMoeda, moeda, moedaParaNumero } from '../utils/formatos';

const PERIODOS = [
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
  [0, 'Tudo'],
];
const ORIGENS = [
  ['todas', 'Todas'],
  ['compra', 'Notas da empresa'],
  ['posto', 'Postos'],
];

const CATEGORIAS = ['Compra de veículo', 'Peças', 'Pneus', 'Serviços', 'Outros'];

// A tela mostra a data como dd/mm/aaaa; a API recebe aaaa-mm-dd.
const hoje = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
const paraISO = (texto) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

const formVazio = () => ({
  categoria: 'Peças',
  numero: '',
  fornecedor: '',
  data: hoje(),
  valor: '',
  descricao: '',
  caminhao_id: null,
});

function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
    </View>
  );
}

function Chip({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.chip, ativo && styles.chipAtivo]}>
      <Text style={[styles.chipTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

function Opcao({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.opcao, ativo && styles.opcaoAtiva]}>
      <Text style={[styles.opcaoTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

function Cartao({ titulo, valor }) {
  return (
    <View style={styles.cartao}>
      <Text style={styles.cartaoValor} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      <Text style={styles.cartaoTitulo}>{titulo}</Text>
    </View>
  );
}

export default function NotasFiscais() {
  const toast = useToast();
  const [dias, setDias] = useState(30);
  const [origem, setOrigem] = useState('todas');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [fornecedorFiltro, setFornecedorFiltro] = useState(null);

  const [dados, setDados] = useState(null); // resumo da última busca
  const [notas, setNotas] = useState([]);   // itens carregados (acumulam no "carregar mais")
  const [fornecedores, setFornecedores] = useState([]);
  const [aberta, setAberta] = useState(null); // nota com os detalhes abertos

  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [confirmando, setConfirmando] = useState(null); // nota aguardando o segundo toque para excluir
  const [baixando, setBaixando] = useState(false);

  const [caminhoes, setCaminhoes] = useState([]);
  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState(formVazio());
  const [foto, setFoto] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca.trim()), 400);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregar = useCallback(
    async (pagina = 1) => {
      try {
        setErro(null);
        const params = new URLSearchParams({ dias: String(dias), origem, pagina: String(pagina) });
        if (buscaAplicada) params.set('busca', buscaAplicada);
        if (fornecedorFiltro) params.set('fornecedor', fornecedorFiltro);

        const r = await api(`/notas-fiscais?${params.toString()}`);
        setDados(r);
        setNotas((atual) => (pagina === 1 ? r.dados : [...atual, ...r.dados]));
        if (Array.isArray(r.fornecedores)) setFornecedores(r.fornecedores);
      } catch (e) {
        setErro('Não foi possível carregar as notas fiscais. Verifique se o servidor está ligado.');
      } finally {
        setCarregando(false);
        setCarregandoMais(false);
        setAtualizando(false);
      }
    },
    [dias, origem, buscaAplicada, fornecedorFiltro]
  );

  useFocusEffect(
    useCallback(() => {
      carregar(1);
      api('/caminhoes').then(setCaminhoes).catch(() => {});
    }, [carregar])
  );

  const opcoesFornecedorFiltro = useMemo(
    () => [
      { valor: null, rotulo: 'Todos os fornecedores' },
      ...fornecedores.map((f) => ({ valor: f, rotulo: f })),
    ],
    [fornecedores]
  );

  const opcoesFornecedorForm = useMemo(
    () => fornecedores.map((f) => ({ valor: f, rotulo: f })),
    [fornecedores]
  );

  const opcoesCaminhao = useMemo(
    () => [
      { valor: null, rotulo: 'Nenhum' },
      ...caminhoes.map((c) => ({
        valor: c.id,
        rotulo: `${c.placa}${c.motorista?.nome ? ` · ${c.motorista.nome}` : ''}`,
      })),
    ],
    [caminhoes]
  );

  const escolherFoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!r.canceled) setFoto(r.assets[0]);
  };

  const abrirNovo = () => {
    setForm(formVazio());
    setFoto(null);
    setErroForm(null);
    setFormAberto(true);
  };

  const fecharForm = () => {
    setFormAberto(false);
    setFoto(null);
    setErroForm(null);
  };

  const salvar = async () => {
    const valor = moedaParaNumero(form.valor);
    const data = paraISO(form.data);
    if (!form.numero.trim() || !String(form.fornecedor).trim()) {
      return setErroForm('Informe o número e o fornecedor.');
    }
    if (!data) return setErroForm('Informe a data no formato dd/mm/aaaa.');
    if (!(valor > 0)) return setErroForm('Informe o valor da nota.');

    setSalvando(true);
    setErroForm(null);
    try {
      if (foto) {
        const corpo = new FormData();
        corpo.append('categoria', form.categoria);
        corpo.append('numero', form.numero.trim());
        corpo.append('fornecedor', String(form.fornecedor).trim());
        corpo.append('data_emissao', data);
        corpo.append('valor_total', String(valor));
        if (form.descricao.trim()) corpo.append('descricao', form.descricao.trim());
        if (form.caminhao_id) corpo.append('caminhao_id', String(form.caminhao_id));
        const nome = foto.fileName ?? 'foto.jpg';
        if (Platform.OS === 'web') {
          corpo.append('foto', await (await fetch(foto.uri)).blob(), nome);
        } else {
          corpo.append('foto', { uri: foto.uri, name: nome, type: foto.mimeType ?? 'image/jpeg' });
        }
        await api('/notas-fiscais', { metodo: 'POST', corpo });
      } else {
        await api('/notas-fiscais', {
          metodo: 'POST',
          corpo: {
            categoria: form.categoria,
            numero: form.numero.trim(),
            fornecedor: String(form.fornecedor).trim(),
            data_emissao: data,
            valor_total: valor,
            descricao: form.descricao.trim() || null,
            caminhao_id: form.caminhao_id,
          },
        });
      }
      fecharForm();
      await carregar(1);
    } catch (e) {
      setErroForm(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (item) => {
    if (confirmando !== item.chave) {
      setConfirmando(item.chave);
      return;
    }
    try {
      await api(`/notas-fiscais/${item.id}`, { metodo: 'DELETE' });
      setConfirmando(null);
      await carregar(1);
    } catch (e) {
      setErro(mensagemDe(e));
      setConfirmando(null);
    }
  };

  const baixar = async () => {
    setBaixando(true);
    try {
      const params = new URLSearchParams({ dias: String(dias), origem });
      if (buscaAplicada) params.set('busca', buscaAplicada);
      if (fornecedorFiltro) params.set('fornecedor', fornecedorFiltro);
      await baixarArquivo(
        `/relatorios/notas-fiscais/exportar?${params.toString()}`,
        'relatorio-notas-fiscais.csv'
      );
      toast.sucesso('Relatório de notas e gastos baixado.');
    } catch (e) {
      toast.erro(e.message || 'Não foi possível baixar o relatório.');
    } finally {
      setBaixando(false);
    }
  };

  const maiorFornecedor = dados?.por_fornecedor?.[0]?.valor ?? 0;

  const topo = (
    <View>
      <TextInput
        style={styles.busca}
        placeholder="Buscar por número ou fornecedor/posto"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <SeletorLista
        rotulo="Fornecedor"
        valor={fornecedorFiltro}
        opcoes={opcoesFornecedorFiltro}
        aoMudar={setFornecedorFiltro}
        placeholder="Todos os fornecedores"
        placeholderBusca="Buscar fornecedor…"
      />
      <View style={styles.chips}>
        {PERIODOS.map(([valor, rotulo]) => (
          <Chip key={valor} texto={rotulo} ativo={dias === valor} aoTocar={() => setDias(valor)} />
        ))}
      </View>
      <View style={styles.chips}>
        {ORIGENS.map(([valor, rotulo]) => (
          <Chip key={valor} texto={rotulo} ativo={origem === valor} aoTocar={() => setOrigem(valor)} />
        ))}
      </View>

      {dados && (
        <>
          <View style={styles.linha}>
            <Cartao titulo="Total das notas" valor={moeda(dados.valor_total)} />
            <Cartao titulo="Notas" valor={dados.total} />
          </View>
          <View style={styles.linha}>
            <Cartao titulo="Notas da empresa" valor={moeda(dados.compras)} />
            <Cartao titulo="Postos (fora da base)" valor={moeda(dados.postos)} />
          </View>

          {dados.por_fornecedor.length > 0 && (
            <View style={styles.caixa}>
              <Text style={styles.secao}>Gasto por fornecedor</Text>
              {dados.por_fornecedor.map((f) => (
                <View key={f.fornecedor} style={{ marginTop: 8 }}>
                  <View style={styles.linhaTexto}>
                    <Text style={styles.fornecedor} numberOfLines={1}>
                      {f.fornecedor}
                    </Text>
                    <Text style={styles.valorForn}>{moeda(f.valor)}</Text>
                  </View>
                  <View style={styles.barraFundo}>
                    <View
                      style={[
                        styles.barra,
                        { width: `${maiorFornecedor > 0 ? Math.max(2, (f.valor / maiorFornecedor) * 100) : 0}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.detalhe}>
                    {f.notas} {f.notas === 1 ? 'nota' : 'notas'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.secaoLista}>Notas do período</Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="Notas fiscais">
        <View style={styles.acoesTopo}>
          <Pressable
            style={styles.botaoBaixar}
            onPress={baixar}
            disabled={baixando}
            accessibilityRole="button"
            accessibilityLabel="Baixar notas e gastos filtrados"
          >
            {baixando ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="download" size={18} color="#fff" />
                <Text style={styles.botaoBaixarTexto}>CSV</Text>
              </>
            )}
          </Pressable>
          <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
            <Text style={styles.botaoNovoTexto}>+ Nova</Text>
          </Pressable>
        </View>
      </Cabecalho>

      <View style={styles.corpo}>
        {erro && <Text style={styles.erro}>{erro}</Text>}
        {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

        <FlatList
          data={notas}
          keyExtractor={(item) => item.chave}
          ListHeaderComponent={topo}
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
            !carregando && !erro ? <Text style={styles.vazio}>Nenhuma nota fiscal no período.</Text> : null
          }
          ListFooterComponent={
            dados && dados.pagina < dados.ultima_pagina ? (
              <Pressable
                style={styles.maisBotao}
                disabled={carregandoMais}
                onPress={() => {
                  setCarregandoMais(true);
                  carregar(dados.pagina + 1);
                }}
              >
                {carregandoMais ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.maisTexto}>
                    Carregar mais ({notas.length} de {dados.total})
                  </Text>
                )}
              </Pressable>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 88 }}
          renderItem={({ item }) => {
            const detalhes = aberta === item.chave;
            return (
              <Pressable style={styles.caixa} onPress={() => setAberta(detalhes ? null : item.chave)}>
                <View style={styles.linhaTexto}>
                  <Text style={styles.numero}>NF {item.numero}</Text>
                  <Text style={styles.valor}>{moeda(item.valor)}</Text>
                </View>
                <Text style={styles.fornecedorItem}>{item.fornecedor}</Text>
                <Text style={styles.detalhe}>
                  {item.data_br} · {item.categoria}
                </Text>
                <Text style={styles.detalhe}>{item.descricao}</Text>

                {detalhes && item.foto_url && (
                  <Image source={{ uri: item.foto_url }} style={styles.foto} resizeMode="contain" />
                )}
                {!detalhes && item.foto_url && (
                  <Text style={styles.verMais}>Toque para ver a foto</Text>
                )}
                {item.pode_excluir && (
                  <Pressable onPress={() => excluir(item)} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                    <Text style={[styles.excluir, confirmando === item.chave && { color: '#dc2626' }]}>
                      {confirmando === item.chave ? 'Confirmar exclusão' : 'Excluir nota'}
                    </Text>
                  </Pressable>
                )}
              </Pressable>
            );
          }}
        />
      </View>
      <Modal visible={formAberto} animationType="slide" onRequestClose={fecharForm}>
        <ScrollView style={styles.tela} contentContainerStyle={styles.formConteudo} keyboardShouldPersistTaps="handled">
          <Cabecalho titulo="Nova nota fiscal" aoVoltar={fecharForm} sangrar />
          <Text style={styles.detalhe}>
            Notas de combustível entram pelas Entradas do tanque; as de manutenção, no lançamento da manutenção.
          </Text>

          <Text style={[styles.rotulo, { marginTop: 12 }]}>Categoria</Text>
          <View style={styles.chips}>
            {CATEGORIAS.map((c) => (
              <Chip key={c} texto={c} ativo={form.categoria === c} aoTocar={() => mudar('categoria', c)} />
            ))}
          </View>

          <Campo rotulo="Número da nota" value={form.numero} onChangeText={(v) => mudar('numero', v)} maxLength={20} />
          <SeletorLista
            rotulo="Fornecedor"
            valor={form.fornecedor || null}
            opcoes={opcoesFornecedorForm}
            aoMudar={(v) => mudar('fornecedor', v ?? '')}
            placeholder="Escolher ou digitar fornecedor…"
            placeholderBusca="Buscar ou digitar novo…"
            permiteLivre
            vazio="Digite o nome do fornecedor na busca."
          />
          <Campo
            rotulo="Data de emissão (dd/mm/aaaa)"
            value={form.data}
            onChangeText={(v) => mudar('data', v)}
            maxLength={10}
          />
          <Campo
            rotulo="Valor"
            placeholder="R$ 0,00"
            value={form.valor}
            onChangeText={(v) => mudar('valor', mascaraMoeda(v))}
            keyboardType="numeric"
          />
          <Campo
            rotulo="Descrição (opcional)"
            placeholder="Ex.: Caminhão Volvo FH 540 0 km"
            value={form.descricao}
            onChangeText={(v) => mudar('descricao', v)}
          />

          <SeletorLista
            rotulo="Caminhão (opcional)"
            valor={form.caminhao_id}
            opcoes={opcoesCaminhao}
            aoMudar={(v) => mudar('caminhao_id', v)}
            placeholder="Nenhum"
            placeholderBusca="Buscar placa…"
          />

          <Text style={styles.rotulo}>Foto da nota (opcional)</Text>
          <View style={styles.opcoes}>
            <Opcao texto={foto ? 'Trocar foto' : 'Escolher foto'} ativo={false} aoTocar={escolherFoto} />
            {foto && <Opcao texto="Remover foto" ativo={false} aoTocar={() => setFoto(null)} />}
          </View>
          {foto && (
            <>
              <Text style={styles.avisoFoto}>Foto selecionada: {foto.fileName ?? 'imagem'}</Text>
              <Image source={{ uri: foto.uri }} style={styles.fotoPreview} resizeMode="contain" />
            </>
          )}

          {erroForm && <Text style={styles.erroForm}>{erroForm}</Text>}

          <Pressable style={[styles.botao, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>Cadastrar nota</Text>}
          </Pressable>
          <Pressable style={styles.botaoSecundario} onPress={fecharForm} disabled={salvando}>
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f3f4f6' },
  corpo: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  busca: { backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipAtivo: { backgroundColor: '#dc2626' },
  chipTexto: { fontSize: 13, fontWeight: '600', color: '#374151' },
  linha: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  cartao: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center' },
  cartaoValor: { fontSize: 20, fontWeight: '700', color: '#111827' },
  cartaoTitulo: { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  secao: { fontSize: 16, fontWeight: '600', color: '#111827' },
  secaoLista: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 8, marginBottom: 8 },
  linhaTexto: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  fornecedor: { fontSize: 14, color: '#374151', flexShrink: 1 },
  valorForn: { fontSize: 14, fontWeight: '600', color: '#111827' },
  barraFundo: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  barra: { height: 8, backgroundColor: '#dc2626' },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 30 },
  numero: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  valor: { fontSize: 16, fontWeight: '700', color: '#dc2626' },
  fornecedorItem: { fontSize: 14, color: '#374151', fontWeight: '600', marginTop: 2 },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 3 },
  verMais: { fontSize: 12, color: '#dc2626', marginTop: 6, fontWeight: '600' },
  foto: { height: 220, borderRadius: 8, marginTop: 8, backgroundColor: '#e5e7eb' },
  maisBotao: { backgroundColor: '#fff', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  maisTexto: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
  excluir: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  acoesTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botaoBaixar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    minWidth: 64,
    justifyContent: 'center',
  },
  botaoBaixarTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  botaoNovo: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 14 },
  formConteudo: {
    paddingBottom: 40,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  grupo: { marginBottom: 12 },
  rotulo: { fontSize: 14, color: '#374151', marginBottom: 6, fontWeight: '500' },
  campo: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16 },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  opcao: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  opcaoAtiva: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
  avisoFoto: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  fotoPreview: { height: 160, borderRadius: 8, marginBottom: 12, backgroundColor: '#e5e7eb' },
  erroForm: { color: '#dc2626', marginBottom: 12 },
  botao: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: '#374151', fontSize: 16, fontWeight: '600' },
});
