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

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [dias, setDias] = useState(30);

  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);

  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);

  const ehManutencao = aba === 'manutencoes';

  // Só pesquisa 0,4 s depois que a pessoa para de digitar.
  useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca.trim()), 400);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregar = useCallback(
    async (numeroPagina = 1) => {
      try {
        setErro(null);
        const params = new URLSearchParams({ pagina: String(numeroPagina), dias: String(dias) });
        if (buscaAplicada) params.set('busca', buscaAplicada);

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
    [aba, dias, buscaAplicada]
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

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const abrirNovo = () => {
    setForm(formVazio());
    setErroForm(null);
    setFormAberto(true);
  };

  const salvar = async () => {
    const data = paraISO(form.data);
    if (!form.caminhao_id) return setErroForm('Escolha o caminhão.');
    if (!data) return setErroForm('Informe a data no formato dd/mm/aaaa.');

    let corpo;
    if (ehManutencao) {
      const valor = moedaParaNumero(form.valor);
      const km = Number(form.km);
      if (!form.tipo.trim()) return setErroForm('Informe o tipo de manutenção.');
      if (Number.isNaN(valor)) return setErroForm('Informe o valor.');
      if (form.km === '' || Number.isNaN(km)) return setErroForm('Informe a quilometragem.');
      corpo = {
        caminhao_id: form.caminhao_id,
        data,
        tipo: form.tipo.trim(),
        descricao: form.descricao.trim() || null,
        valor,
        km,
      };
    } else {
      corpo = { caminhao_id: form.caminhao_id, data, observacao: form.observacao.trim() || null };
    }

    setSalvando(true);
    setErroForm(null);
    try {
      await api(`/${aba}`, { metodo: 'POST', corpo });
      setFormAberto(false);
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
      <Text style={styles.resumo}>
        {ehManutencao
          ? `${total} ${total === 1 ? 'manutenção' : 'manutenções'} · ${moeda(totalValor)} no total`
          : `${total} ${total === 1 ? 'lavagem' : 'lavagens'}`}
      </Text>
    </View>
  );

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="LAVAGENS E MANUTENÇÕES">
        <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
          <Text style={styles.botaoNovoTexto}>+ Novo</Text>
        </Pressable>
      </Cabecalho>

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
            {!ehManutencao && item.observacao ? <Text style={styles.detalhe}>{item.observacao}</Text> : null}
          </View>
        )}
      />

      <Modal visible={formAberto} animationType="slide" onRequestClose={() => setFormAberto(false)}>
        <ScrollView style={styles.tela} contentContainerStyle={styles.formConteudo} keyboardShouldPersistTaps="handled">
          <Text style={styles.titulo}>{ehManutencao ? 'Nova manutenção' : 'Nova lavagem'}</Text>

          <Text style={styles.rotulo}>Caminhão</Text>
          <View style={styles.opcoes}>
            {caminhoesDisponiveis.length === 0 && (
              <Text style={styles.detalhe}>Nenhum caminhão com motorista responsável.</Text>
            )}
            {caminhoesDisponiveis.map((c) => (
              <Opcao
                key={c.id}
                texto={c.placa}
                ativo={form.caminhao_id === c.id}
                aoTocar={() =>
                  setForm((atual) => ({ ...atual, caminhao_id: c.id, km: atual.km || String(c.km_atual ?? '') }))
                }
              />
            ))}
          </View>

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
          <Pressable style={styles.botaoSecundario} onPress={() => setFormAberto(false)} disabled={salvando}>
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingTop: 56 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  botaoNovo: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
  segmentos: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, padding: 3, marginBottom: 12 },
  segmento: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  segmentoAtivo: { backgroundColor: '#2563eb' },
  segmentoTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
  busca: { backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipAtivo: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipTexto: { fontSize: 13, fontWeight: '600', color: '#374151' },
  resumo: { fontSize: 13, color: '#374151', fontWeight: '600', marginBottom: 10 },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  principal: { fontSize: 16, fontWeight: 'bold', color: '#111827', flexShrink: 1, marginRight: 8 },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  valor: { fontSize: 13, color: '#2563eb', marginTop: 4, fontWeight: '600' },
  excluir: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  excluirAtivo: { color: '#dc2626' },
  maisBotao: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  maisTexto: { color: '#2563eb', fontWeight: '600', fontSize: 15 },

  formConteudo: { paddingBottom: 40, width: '100%', maxWidth: 520, alignSelf: 'center' },
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
  opcaoAtiva: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
  erroForm: { color: '#dc2626', marginBottom: 12 },
  botao: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: '#374151', fontSize: 16, fontWeight: '600' },
});