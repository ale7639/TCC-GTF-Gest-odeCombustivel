import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import {
  CINZA_FUNDO,
  RAIO_CARTAO,
  sombraSuave,
  TEXTO,
  TEXTO_SUAVE,
  VERMELHO,
} from '../ui/tema';

const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

const FILTROS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'abastecimento', rotulo: 'Abastecimento' },
  { id: 'lavagem', rotulo: 'Lavagem' },
  { id: 'manutencao', rotulo: 'Manutenção' },
];

const STATUS = {
  pendente: { texto: 'Aguardando aprovação', cor: '#b45309' },
  aprovado: { texto: 'Aprovado', cor: '#16a34a' },
  recusado: { texto: 'Recusado', cor: '#dc2626' },
};

function EtiquetaStatus({ status }) {
  const s = STATUS[status] ?? STATUS.pendente;
  return (
    <View style={[styles.etiqueta, { backgroundColor: `${s.cor}22` }]}>
      <Text style={[styles.etiquetaTexto, { color: s.cor }]}>{s.texto}</Text>
    </View>
  );
}

export default function MeusLancamentos() {
  const [filtro, setFiltro] = useState('todos');
  const [historico, setHistorico] = useState([]);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async (tipo = filtro) => {
    try {
      setErro(null);
      const q = tipo && tipo !== 'todos' ? `?tipo=${tipo}` : '';
      const r = await api(`/meu/painel${q}`);
      setHistorico(r.historico ?? []);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [filtro]);

  useFocusEffect(
    useCallback(() => {
      setCarregando(true);
      carregar(filtro);
    }, [carregar, filtro])
  );

  const cabecalho = useMemo(
    () => (
      <View style={styles.chips}>
        {FILTROS.map((f) => {
          const ativo = filtro === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => {
                setFiltro(f.id);
                setCarregando(true);
              }}
              style={[styles.chip, ativo && styles.chipAtivo]}
            >
              <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{f.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [filtro]
  );

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="Meus lançamentos" />

      <View style={styles.corpo}>
        {erro && <Text style={styles.erro}>{erro}</Text>}
        {carregando && !erro ? (
          <ActivityIndicator size="large" color={VERMELHO} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={historico}
            keyExtractor={(item) => `${item.tipo}-${item.id}`}
            ListHeaderComponent={cabecalho}
            refreshControl={
              <RefreshControl
                refreshing={atualizando}
                onRefresh={() => {
                  setAtualizando(true);
                  carregar(filtro);
                }}
                tintColor={VERMELHO}
              />
            }
            ListEmptyComponent={
              <Text style={styles.vazio}>Nenhum lançamento neste filtro.</Text>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item }) => (
              <View style={styles.caixa}>
                <Text style={styles.itemTitulo}>{item.titulo}</Text>
                <Text style={styles.detalhe}>{item.data_br}</Text>
                {item.linhas.map((l, i) => (
                  <Text key={i} style={styles.detalhe}>
                    {l}
                  </Text>
                ))}
                <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                  <EtiquetaStatus status={item.status} />
                </View>
                {item.status === 'recusado' && item.motivo_recusa && (
                  <Text style={styles.motivo}>Motivo: {item.motivo_recusa}</Text>
                )}
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CINZA_FUNDO },
  corpo: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipAtivo: { backgroundColor: VERMELHO, borderColor: VERMELHO },
  chipTexto: { fontSize: 13, fontWeight: '600', color: TEXTO_SUAVE },
  chipTextoAtivo: { color: '#fff' },
  erro: { color: VERMELHO, textAlign: 'center', marginTop: 20 },
  vazio: { textAlign: 'center', color: TEXTO_SUAVE, marginTop: 30 },
  caixa: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CARTAO,
    padding: 14,
    marginBottom: 8,
    ...sombraSuave,
  },
  itemTitulo: { fontSize: 16, fontWeight: '700', color: TEXTO },
  detalhe: { fontSize: 13, color: TEXTO_SUAVE, marginTop: 3 },
  etiqueta: { borderRadius: 8, paddingVertical: 3, paddingHorizontal: 10 },
  etiquetaTexto: { fontSize: 12, fontWeight: '600' },
  motivo: { fontSize: 13, color: VERMELHO, marginTop: 6 },
});
