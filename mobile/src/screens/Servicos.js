import { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import SeletorLista from '../components/SeletorLista';
import { mascaraMoeda, moeda, moedaParaNumero } from '../utils/formatos';

const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));

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

const PERIODOS = [
  [0, 'Tudo'],
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
];
const TIPOS_MANUTENCAO = ['Troca de óleo', 'Pneus', 'Freios', 'Revisão'];

const formVazio = () => ({
  caminhao_id: null,
  data: hoje(),
  observacao: '',
  tipo: '',
  descricao: '',
  valor: '',
  km: '',
  nf_numero: '',
  nf_fornecedor: '',
});

function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
    </View>
  );
}

function Opcao({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.opcao, ativo && styles.opcaoAtiva]}>
      <Text style={[styles.opcaoTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

function Chip({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.chip, ativo && styles.chipAtivo]}>
      <Text style={[styles.chipTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

export default function Servicos() {
  const [aba, setAba] = useState('manutencoes'); // 'manutencoes' ou 'lavagens'
  const [itens, setItens] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalValor, setTotalValor] = useState(0);
  const [caminhoes, setCaminhoes] = useState([]);

  const [caminhaoFiltro, setCaminhaoFiltro] = useState(null);
  const [dias, setDias] = useState(30);

  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);

  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState(formVazio());
  const [foto, setFoto] = useState(null);
  const [fotoAberta, setFotoAberta] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);

  const ehManutencao = aba === 'manutencoes';

  const carregar = useCallback(
    async (numeroPagina = 1) => {
      try {
        setErro(null);
        const params = new URLSearchParams({ pagina: String(numeroPagina), dias: String(dias) });
        if (caminhaoFiltro) params.set('caminhao_id', String(caminhaoFiltro));

        const r = await api(`/${aba}?${params.toString()}`);
        setItens((atual) => (numeroPagina === 1 ? r.dados : [...atual, ...r.dados]));
        setPagina(r.pagina);
        setUltimaPagina(r.ultima_pagina);
        setTotal(r.total);
        setTotalValor(r.total_valor ?? 0);
      } catch (e) {
        setErro('Não foi possível carregar a lista. Verifique se o servidor está ligado.');
      } finally {
        setCarregando(false);
        setCarregandoMais(false);
        setAtualizando(false);
      }
    },
    [aba, dias, caminhaoFiltro]
  );

  useFocusEffect(
    useCallback(() => {
      setConfirmandoId(null);
      carregar(1);
      api('/caminhoes').then(setCaminhoes).catch(() => {});
    }, [carregar])
  );

  // Só caminhões com motorista responsável (o lançamento fica no nome dele).
  const caminhoesDisponiveis = caminhoes.filter((c) => c.motorista_id);

  const opcoesCaminhaoForm = useMemo(
    () =>
      caminhoesDisponiveis.map((c) => ({
        valor: c.id,
        rotulo: `${c.placa} · ${c.motorista?.nome ?? 'sem motorista'}`,
      })),
    [caminhoesDisponiveis]
  );

  const opcoesCaminhaoFiltro = useMemo(
    () => [
      { valor: null, rotulo: 'Todos os caminhões' },
      ...caminhoes.map((c) => ({
        valor: c.id,
        rotulo: `${c.placa}${c.motorista?.nome ? ` · ${c.motorista.nome}` : ''}`,
      })),
    ],
    [caminhoes]
  );

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const escolherCaminhaoForm = (id) => {
    const c = caminhoesDisponiveis.find((x) => x.id === id);
    setForm((atual) => ({
      ...atual,
      caminhao_id: id,
      km: atual.km || (c ? String(c.km_atual ?? '') : ''),
    }));
  };

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
    const data = paraISO(form.data);
    if (!form.caminhao_id) return setErroForm('Escolha o caminhão.');
    if (!data) return setErroForm('Informe a data no formato dd/mm/aaaa.');

    let valor;
    let km;
    let nfNumero = '';
    let nfFornecedor = '';
    if (ehManutencao) {
      valor = moedaParaNumero(form.valor);
      km = Number(form.km);
      nfNumero = form.nf_numero.trim();
      nfFornecedor = form.nf_fornecedor.trim();
      if (!form.tipo.trim()) return setErroForm('Informe o tipo de manutenção.');
      if (Number.isNaN(valor)) return setErroForm('Informe o valor.');
      if (form.km === '' || Number.isNaN(km)) return setErroForm('Informe a quilometragem.');
      if (foto && !nfNumero) return setErroForm('Informe o número da nota para anexar a foto.');
      if (nfNumero && !nfFornecedor) return setErroForm('Informe a oficina/fornecedor da nota.');
    }

    setSalvando(true);
    setErroForm(null);
    try {
      if (ehManutencao) {
        if (foto) {
          const corpo = new FormData();
          corpo.append('caminhao_id', String(form.caminhao_id));
          corpo.append('data', data);
          corpo.append('tipo', form.tipo.trim());
          if (form.descricao.trim()) corpo.append('descricao', form.descricao.trim());
          corpo.append('valor', String(valor));
          corpo.append('km', String(km));
          corpo.append('nf_numero', nfNumero);
          corpo.append('nf_fornecedor', nfFornecedor);
          const nome = foto.fileName ?? 'foto.jpg';
          if (Platform.OS === 'web') {
            corpo.append('foto', await (await fetch(foto.uri)).blob(), nome);
          } else {
            corpo.append('foto', { uri: foto.uri, name: nome, type: foto.mimeType ?? 'image/jpeg' });
          }
          await api(`/${aba}`, { metodo: 'POST', corpo });
        } else {
          await api(`/${aba}`, {
            metodo: 'POST',
            corpo: {
              caminhao_id: form.caminhao_id,
              data,
              tipo: form.tipo.trim(),
              descricao: form.descricao.trim() || null,
              valor,
              km,
              nf_numero: nfNumero || null,
              nf_fornecedor: nfFornecedor || null,
            },
          });
        }
      } else {
        await api(`/${aba}`, {
          metodo: 'POST',
          corpo: { caminhao_id: form.caminhao_id, data, observacao: form.observacao.trim() || null },
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

  const filtros = (
    <View>
      <SeletorLista
        rotulo="Caminhão"
        valor={caminhaoFiltro}
        opcoes={opcoesCaminhaoFiltro}
        aoMudar={setCaminhaoFiltro}
        placeholder="Todos os caminhões"
        placeholderBusca="Buscar placa ou motorista…"
      />
      <View style={styles.chips}>
        {PERIODOS.map(([valor, rotulo]) => (
          <Chip key={valor} texto={rotulo} ativo={dias === valor} aoTocar={() => setDias(valor)} />
        ))}
      </View>
      <Text style={styles.resumo}>
        {ehManutencao
          ? `${total} ${total === 1 ? 'manutenção' : 'manutenções'} · ${moeda(totalValor)} no total`
          : `${total} ${total === 1 ? 'lavagem' : 'lavagens'}`}
      </Text>
    </View>
  );

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="Serviços">
        <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
          <Text style={styles.botaoNovoTexto}>+ Novo</Text>
        </Pressable>
      </Cabecalho>

      <View style={styles.corpo}>
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
                setCaminhaoFiltro(null);
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
          contentContainerStyle={{ paddingBottom: 88 }}
          renderItem={({ item }) => (
            <View style={styles.caixa}>
              <View style={styles.topo}>
                <Text style={styles.principal}>
                  {ehManutencao ? `${item.placa} · ${item.tipo}` : `${item.placa} · Lavagem`}
                </Text>
                <Pressable onPress={() => excluir(item.id)}>
                  <Text style={[styles.excluir, confirmandoId === item.id && styles.excluirAtivo]}>
                    {confirmandoId === item.id ? 'Confirmar exclusão' : 'Excluir'}
                  </Text>
                </Pressable>
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
              {ehManutencao && item.foto_url ? (
                <Pressable onPress={() => setFotoAberta(item.foto_url)}>
                  <Text style={styles.verFoto}>Ver foto da nota</Text>
                </Pressable>
              ) : null}
              {!ehManutencao && item.observacao ? <Text style={styles.detalhe}>{item.observacao}</Text> : null}
            </View>
          )}
        />
      </View>

      <Modal visible={formAberto} animationType="slide" onRequestClose={fecharForm}>
        <ScrollView style={styles.tela} contentContainerStyle={styles.formConteudo} keyboardShouldPersistTaps="handled">
          <Cabecalho
            titulo={ehManutencao ? 'Nova manutenção' : 'Nova lavagem'}
            aoVoltar={fecharForm}
            sangrar
          />

          <SeletorLista
            rotulo="Caminhão"
            valor={form.caminhao_id}
            opcoes={opcoesCaminhaoForm}
            aoMudar={escolherCaminhaoForm}
            placeholder="Escolher caminhão…"
            placeholderBusca="Buscar placa ou motorista…"
            vazio="Nenhum caminhão com motorista responsável."
          />

          <Campo rotulo="Data (dd/mm/aaaa)" value={form.data} onChangeText={(v) => mudar('data', v)} maxLength={10} />

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
                rotulo="Valor"
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
            {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>Registrar</Text>}
          </Pressable>
          <Pressable style={styles.botaoSecundario} onPress={fecharForm} disabled={salvando}>
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>
        </ScrollView>
      </Modal>

      <Modal visible={!!fotoAberta} transparent animationType="fade" onRequestClose={() => setFotoAberta(null)}>
        <Pressable style={styles.fotoModal} onPress={() => setFotoAberta(null)}>
          {fotoAberta ? (
            <Image source={{ uri: fotoAberta }} style={styles.fotoGrande} resizeMode="contain" />
          ) : null}
          <Text style={styles.fecharFoto}>Toque para fechar</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f3f4f6' },
  corpo: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  botaoNovo: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 14 },
  segmentos: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, padding: 3, marginBottom: 12 },
  segmento: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  segmentoAtivo: { backgroundColor: '#dc2626' },
  segmentoTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipAtivo: { backgroundColor: '#dc2626' },
  chipTexto: { fontSize: 13, fontWeight: '600', color: '#374151' },
  resumo: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  principal: { fontSize: 16, fontWeight: '700', color: '#1f2937', flexShrink: 1, marginRight: 8 },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  valor: { fontSize: 13, color: '#dc2626', marginTop: 4, fontWeight: '600' },
  verFoto: { fontSize: 13, color: '#dc2626', fontWeight: '600', marginTop: 6 },
  excluir: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  excluirAtivo: { color: '#dc2626' },
  maisBotao: { backgroundColor: '#fff', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  maisTexto: { color: '#dc2626', fontWeight: '600', fontSize: 15 },

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
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
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
  erroForm: { color: '#dc2626', marginBottom: 12 },
  secaoForm: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 4, marginBottom: 10 },
  avisoFoto: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  fotoPreview: { height: 160, borderRadius: 8, marginBottom: 12, backgroundColor: '#e5e7eb' },
  botao: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: '#374151', fontSize: 16, fontWeight: '600' },
  fotoModal: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  fotoGrande: { width: '100%', height: '80%', maxWidth: 720 },
  fecharFoto: { color: '#fff', marginTop: 12, fontWeight: '600' },
});
