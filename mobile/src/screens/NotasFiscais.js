import { useCallback, useEffect, useState } from 'react';
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
import { moeda } from '../utils/formatos';

const PERIODOS = [
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
  [0, 'Tudo'],
];
const ORIGENS = [
  ['todas', 'Todas'],
  ['compra', 'Compras (tanque)'],
  ['posto', 'Postos'],
];

function Chip({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.chip, ativo && styles.chipAtivo]}>
      <Text style={[styles.chipTexto, ativo && { color: '#fff' }]}>{texto}</Text>
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
  const [dias, setDias] = useState(30);
  const [origem, setOrigem] = useState('todas');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');

  const [dados, setDados] = useState(null); // resumo da última busca
  const [notas, setNotas] = useState([]);   // itens carregados (acumulam no "carregar mais")
  const [aberta, setAberta] = useState(null); // nota com os detalhes abertos

  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);

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

        const r = await api(`/notas-fiscais?${params.toString()}`);
        setDados(r);
        setNotas((atual) => (pagina === 1 ? r.dados : [...atual, ...r.dados]));
      } catch (e) {
        setErro('Não foi possível carregar as notas fiscais. Verifique se o servidor está ligado.');
      } finally {
        setCarregando(false);
        setCarregandoMais(false);
        setAtualizando(false);
      }
    },
    [dias, origem, buscaAplicada]
  );

  useFocusEffect(
    useCallback(() => {
      carregar(1);
    }, [carregar])
  );

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
            <Cartao titulo="Compras para o tanque" valor={moeda(dados.compras)} />
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
      <Cabecalho titulo="NOTAS FISCAIS" />

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
        contentContainerStyle={{ paddingBottom: 24 }}
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
                {item.data_br} · {item.origem === 'posto' ? 'Posto' : 'Compra'}
              </Text>
              <Text style={styles.detalhe}>{item.descricao}</Text>

              {detalhes && item.chave_acesso && (
                <Text style={styles.chaveAcesso}>Chave de acesso: {item.chave_acesso}</Text>
              )}
              {detalhes && item.foto_url && (
                <Image source={{ uri: item.foto_url }} style={styles.foto} resizeMode="contain" />
              )}
              {!detalhes && (item.chave_acesso || item.foto_url) && (
                <Text style={styles.verMais}>Toque para ver {item.foto_url ? 'a foto' : 'a chave de acesso'}</Text>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingTop: 56 },
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
  linha: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  cartao: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center' },
  cartaoValor: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  cartaoTitulo: { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  secao: { fontSize: 16, fontWeight: '600', color: '#111827' },
  secaoLista: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 8, marginBottom: 8 },
  linhaTexto: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  fornecedor: { fontSize: 14, color: '#374151', flexShrink: 1 },
  valorForn: { fontSize: 14, fontWeight: '600', color: '#111827' },
  barraFundo: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  barra: { height: 8, backgroundColor: '#2563eb' },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 30 },
  numero: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  valor: { fontSize: 16, fontWeight: 'bold', color: '#2563eb' },
  fornecedorItem: { fontSize: 14, color: '#374151', fontWeight: '600', marginTop: 2 },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 3 },
  chaveAcesso: { fontSize: 12, color: '#374151', marginTop: 8 },
  verMais: { fontSize: 12, color: '#2563eb', marginTop: 6, fontWeight: '600' },
  foto: { height: 220, borderRadius: 8, marginTop: 8, backgroundColor: '#e5e7eb' },
  maisBotao: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  maisTexto: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
});