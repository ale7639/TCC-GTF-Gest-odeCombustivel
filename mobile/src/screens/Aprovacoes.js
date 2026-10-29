import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';

const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

const FILTROS = [
  ['pendente', 'Pendentes'],
  ['aprovado', 'Aprovados'],
  ['recusado', 'Recusados'],
];

const COR = { pendente: '#b45309', aprovado: '#16a34a', recusado: '#dc2626' };

export default function Aprovacoes() {
  const [status, setStatus] = useState('pendente');
  const [itens, setItens] = useState([]);
  const [pendentes, setPendentes] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [trabalhando, setTrabalhando] = useState(null); // "tipo-id" do item sendo aprovado/recusado
  const [recusando, setRecusando] = useState(null);     // "tipo-id" do item com o campo de motivo aberto
  const [motivo, setMotivo] = useState('');

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const r = await api(`/aprovacoes?status=${status}`);
      setItens(r.itens);
      setPendentes(r.pendentes);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const decidir = async (item, acao) => {
    const chave = `${item.tipo}-${item.id}`;
    setTrabalhando(chave);
    setErro(null);
    try {
      await api(`/aprovacoes/${item.tipo}/${item.id}/${acao}`, {
        metodo: 'POST',
        corpo: acao === 'recusar' ? { motivo: motivo.trim() || null } : undefined,
      });
      setRecusando(null);
      setMotivo('');
      await carregar();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setTrabalhando(null);
    }
  };

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="APROVAÇÕES" />

      <View style={styles.chips}>
        {FILTROS.map(([valor, rotulo]) => (
          <Pressable
            key={valor}
            onPress={() => setStatus(valor)}
            style={[styles.chip, status === valor && styles.chipAtivo]}
          >
            <Text style={[styles.chipTexto, status === valor && { color: '#fff' }]}>
              {rotulo}
              {valor === 'pendente' && pendentes > 0 ? ` (${pendentes})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      <FlatList
        data={itens}
        keyExtractor={(item) => `${item.tipo}-${item.id}`}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => {
              setAtualizando(true);
              carregar();
            }}
          />
        }
        ListEmptyComponent={
          !carregando && !erro ? (
            <Text style={styles.vazio}>
              {status === 'pendente' ? 'Nada aguardando aprovação.' : 'Nenhum lançamento nesta lista.'}
            </Text>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const chave = `${item.tipo}-${item.id}`;
          const ocupado = trabalhando === chave;
          return (
            <View style={styles.caixa}>
              <Text style={styles.titulo}>{item.titulo}</Text>
              <Text style={styles.quem}>
                {item.placa} · {item.motorista} · {item.data_br}
              </Text>
              {item.linhas.map((l, i) => (
                <Text key={i} style={styles.detalhe}>
                  {l}
                </Text>
              ))}

              {item.foto_url && (
                <Image source={{ uri: item.foto_url }} style={styles.foto} resizeMode="cover" />
              )}

              {item.status !== 'pendente' && (
                <Text style={[styles.situacao, { color: COR[item.status] }]}>
                  {item.status === 'aprovado' ? 'Aprovado' : 'Recusado'}
                  {item.motivo_recusa ? ` · ${item.motivo_recusa}` : ''}
                </Text>
              )}

              {item.status === 'pendente' && recusando !== chave && (
                <View style={styles.botoes}>
                  <Pressable
                    style={[styles.aprovar, ocupado && styles.desativado]}
                    disabled={ocupado}
                    onPress={() => decidir(item, 'aprovar')}
                  >
                    {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={styles.aprovarTexto}>Aprovar</Text>}
                  </Pressable>
                  <Pressable
                    style={styles.recusar}
                    disabled={ocupado}
                    onPress={() => {
                      setRecusando(chave);
                      setMotivo('');
                    }}
                  >
                    <Text style={styles.recusarTexto}>Recusar</Text>
                  </Pressable>
                </View>
              )}

              {item.status === 'pendente' && recusando === chave && (
                <View style={{ marginTop: 10 }}>
                  <TextInput
                    style={styles.campo}
                    placeholder="Motivo da recusa (opcional)"
                    value={motivo}
                    onChangeText={setMotivo}
                    maxLength={255}
                  />
                  <View style={styles.botoes}>
                    <Pressable
                      style={[styles.confirmarRecusa, ocupado && styles.desativado]}
                      disabled={ocupado}
                      onPress={() => decidir(item, 'recusar')}
                    >
                      {ocupado ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.aprovarTexto}>Confirmar recusa</Text>
                      )}
                    </Pressable>
                    <Pressable style={styles.recusar} disabled={ocupado} onPress={() => setRecusando(null)}>
                      <Text style={styles.cancelarTexto}>Cancelar</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingTop: 56 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
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
  erro: { color: '#dc2626', marginVertical: 10, textAlign: 'center' },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  titulo: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  quem: { fontSize: 13, color: '#374151', fontWeight: '600', marginTop: 3 },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 3 },
  foto: { height: 180, borderRadius: 8, marginTop: 8, backgroundColor: '#e5e7eb' },
  situacao: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  botoes: { flexDirection: 'row', gap: 8, marginTop: 10 },
  aprovar: { flex: 1, backgroundColor: '#16a34a', borderRadius: 8, padding: 11, alignItems: 'center' },
  aprovarTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
  recusar: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    padding: 11,
    alignItems: 'center',
  },
  recusarTexto: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
  confirmarRecusa: { flex: 1, backgroundColor: '#dc2626', borderRadius: 8, padding: 11, alignItems: 'center' },
  cancelarTexto: { color: '#374151', fontWeight: '600', fontSize: 15 },
  desativado: { opacity: 0.6 },
  campo: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
});