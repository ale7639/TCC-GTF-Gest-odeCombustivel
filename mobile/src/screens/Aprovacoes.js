import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import { linkWhatsApp } from '../utils/formatos';
import { cores } from '../ui/tema';

const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

const FILTROS = [
  ['pendente', 'Pendentes'],
  ['aprovado', 'Aprovados'],
  ['recusado', 'Recusados'],
];

// Ícone de cada tipo de lançamento.
const ICONE = { abastecimento: 'gas-station', lavagem: 'car-wash', manutencao: 'wrench' };

// Etiqueta de situação (fundo + texto).
const SITUACAO = {
  pendente: { texto: 'Pendente', fundo: cores.primariaClara, cor: cores.primariaEscura },
  aprovado: { texto: 'Aprovado', fundo: cores.bordaClara, cor: cores.texto },
  recusado: { texto: 'Recusado', fundo: cores.primariaClara, cor: cores.perigo },
};

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

      <View style={styles.segmentos}>
        {FILTROS.map(([valor, rotulo]) => (
          <Pressable
            key={valor}
            onPress={() => setStatus(valor)}
            style={[styles.segmento, status === valor && styles.segmentoAtivo]}
          >
            <Text style={[styles.segmentoTexto, status === valor && { color: '#fff' }]}>
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
          const situacao = SITUACAO[item.status] ?? SITUACAO.pendente;
          const whats = linkWhatsApp(
            item.telefone,
            `Olá, ${item.motorista.split(' ')[0]}! Sobre o lançamento "${item.titulo}" do caminhão ${item.placa} em ${item.data_br}: `
          );
          return (
            <View style={styles.caixa}>
              {/* Topo: ícone do tipo + título + etiqueta de situação */}
              <View style={styles.topo}>
                <View style={styles.icone}>
                  <MaterialCommunityIcons name={ICONE[item.tipo] ?? 'file-outline'} size={20} color={cores.primaria} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.titulo} numberOfLines={1}>
                    {item.titulo}
                  </Text>
                  <Text style={styles.quem} numberOfLines={1}>
                    {item.placa} · {item.motorista}
                  </Text>
                </View>
                <View style={[styles.etiqueta, { backgroundColor: situacao.fundo }]}>
                  <Text style={[styles.etiquetaTexto, { color: situacao.cor }]}>{situacao.texto}</Text>
                </View>
              </View>

              {/* Detalhes numa linha só */}
              <Text style={styles.detalhe}>{[item.data_br, ...item.linhas].join(' · ')}</Text>

              {item.foto_url && (
                <Image source={{ uri: item.foto_url }} style={styles.foto} resizeMode="cover" />
              )}

              {item.status === 'recusado' && item.motivo_recusa && (
                <Text style={styles.motivo}>Motivo: {item.motivo_recusa}</Text>
              )}

              {/* Rodapé: WhatsApp discreto (ícone) quando não há botões de decisão */}
              {item.status !== 'pendente' && whats && (
                <View style={styles.rodape}>
                  <Pressable style={styles.whatsLink} onPress={() => Linking.openURL(whats)} hitSlop={6}>
                    <MaterialCommunityIcons name="whatsapp" size={18} color={cores.whatsapp} />
                    <Text style={styles.whatsLinkTexto}>Falar com o motorista</Text>
                  </Pressable>
                </View>
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
                  {whats && (
                    <Pressable style={styles.whatsIcone} onPress={() => Linking.openURL(whats)} accessibilityLabel="WhatsApp">
                      <MaterialCommunityIcons name="whatsapp" size={22} color="#fff" />
                    </Pressable>
                  )}
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
  tela: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 16, paddingTop: 56 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
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
  erro: { color: cores.perigo, marginVertical: 10, textAlign: 'center' },
  vazio: { textAlign: 'center', color: cores.textoSecundario, marginTop: 40 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  titulo: { fontSize: 16, fontWeight: 'bold', color: cores.texto },
  quem: { fontSize: 13, color: cores.textoMedio, fontWeight: '600', marginTop: 3 },
  detalhe: { fontSize: 13, color: cores.textoSecundario, marginTop: 8 },
  foto: { height: 180, borderRadius: 8, marginTop: 8, backgroundColor: cores.bordaClara },
  situacao: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  botoes: { flexDirection: 'row', gap: 8, marginTop: 10 },
  aprovar: { flex: 1, backgroundColor: cores.primaria, borderRadius: 8, padding: 11, alignItems: 'center' },
  aprovarTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
  recusar: {
    flex: 1,
    borderWidth: 1,
    borderColor: cores.perigo,
    borderRadius: 8,
    padding: 11,
    alignItems: 'center',
  },
  recusarTexto: { color: cores.perigo, fontWeight: '600', fontSize: 15 },
  confirmarRecusa: { flex: 1, backgroundColor: cores.perigo, borderRadius: 8, padding: 11, alignItems: 'center' },
  cancelarTexto: { color: cores.textoMedio, fontWeight: '600', fontSize: 15 },
  desativado: { opacity: 0.6 },
  whats: {
    alignSelf: 'flex-start',
    backgroundColor: cores.whatsapp,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  whatsTexto: { color: '#fff', fontWeight: '600', fontSize: 13 },
  campo: {
    backgroundColor: cores.fundo,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  segmentos: { flexDirection: 'row', backgroundColor: cores.bordaClara, borderRadius: 10, padding: 3, marginBottom: 12 },
  segmento: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentoAtivo: { backgroundColor: cores.primaria },
  segmentoTexto: { fontSize: 13, fontWeight: '600', color: cores.textoMedio },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icone: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: cores.primariaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etiqueta: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  etiquetaTexto: { fontSize: 12, fontWeight: '700' },
  motivo: { fontSize: 13, color: cores.perigo, marginTop: 6 },
  rodape: { flexDirection: 'row', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: cores.bordaClara },
  whatsLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whatsLinkTexto: { fontSize: 13, fontWeight: '600', color: cores.textoMedio },
  whatsIcone: {
    width: 44,
    borderRadius: 8,
    backgroundColor: cores.whatsapp,
    alignItems: 'center',
    justifyContent: 'center',
  },
});