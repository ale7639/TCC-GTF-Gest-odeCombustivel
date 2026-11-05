import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

// "2026-10-29 19:25:10" -> "29/10/2026 às 19:25"
const dataHoraBR = (s) => {
  const [data, hora] = s.split(' ');
  return `${data.split('-').reverse().join('/')} às ${hora.slice(0, 5)}`;
};

const SITUACOES = [
  ['todos', 'Todos'],
  ['sucesso', 'Sucesso'],
  ['falha', 'Falhas'],
];
const PERIODOS = [
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
  [0, 'Tudo'],
];

function Chip({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.chip, ativo && styles.chipAtivo]}>
      <Text style={[styles.chipTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

export default function LogAcesso() {
  const [registros, setRegistros] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [loginsOk, setLoginsOk] = useState(0);
  const [falhas, setFalhas] = useState(0);

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [situacao, setSituacao] = useState('todos');
  const [dias, setDias] = useState(30);

  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);

  // Só pesquisa 0,4 s depois que a pessoa para de digitar.
  useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca.trim()), 400);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregar = useCallback(
    async (numeroPagina = 1) => {
      try {
        setErro(null);
        const params = new URLSearchParams({
          pagina: String(numeroPagina),
          dias: String(dias),
          situacao,
        });
        if (buscaAplicada) params.set('busca', buscaAplicada);

        const r = await api(`/logs-acesso?${params.toString()}`);
        setRegistros((atual) => (numeroPagina === 1 ? r.dados : [...atual, ...r.dados]));
        setPagina(r.pagina);
        setUltimaPagina(r.ultima_pagina);
        setTotal(r.total);
        setLoginsOk(r.logins_ok);
        setFalhas(r.falhas);
      } catch (e) {
        setErro('Não foi possível carregar o log. Verifique se o servidor está ligado.');
      } finally {
        setCarregando(false);
        setCarregandoMais(false);
        setAtualizando(false);
      }
    },
    [dias, situacao, buscaAplicada]
  );

  useFocusEffect(
    useCallback(() => {
      carregar(1);
    }, [carregar])
  );

  const filtros = (
    <View style={styles.filtros}>
      <TextInput
        style={styles.busca}
        placeholder="Buscar por e-mail ou IP"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.chips}>
        {SITUACOES.map(([valor, rotulo]) => (
          <Chip key={valor} texto={rotulo} ativo={situacao === valor} aoTocar={() => setSituacao(valor)} />
        ))}
      </View>
      <View style={styles.chips}>
        {PERIODOS.map(([valor, rotulo]) => (
          <Chip key={valor} texto={rotulo} ativo={dias === valor} aoTocar={() => setDias(valor)} />
        ))}
      </View>
      <Text style={styles.resumo}>
        {loginsOk} {loginsOk === 1 ? 'login com sucesso' : 'logins com sucesso'} · {falhas}{' '}
        {falhas === 1 ? 'tentativa falha' : 'tentativas falhas'}
      </Text>
    </View>
  );

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="LOG DE ACESSO" />

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      <FlatList
        data={registros}
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
                  Carregar mais ({registros.length} de {total})
                </Text>
              )}
            </Pressable>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const saida = item.evento === 'logout';
          const titulo = saida ? 'Saída' : item.sucesso ? 'Login' : 'Tentativa falha';
          const cor = saida ? '#6b7280' : item.sucesso ? '#16a34a' : '#dc2626';
          return (
            <View style={styles.caixa}>
              <View style={styles.topo}>
                <Text style={[styles.titulo, { color: cor }]}>{titulo}</Text>
                <Text style={styles.data}>{dataHoraBR(item.data_hora)}</Text>
              </View>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.detalhe}>
                IP {item.ip ?? '—'} · {item.dispositivo ?? 'Desconhecido'}
              </Text>
              {item.motivo && <Text style={styles.motivo}>{item.motivo}</Text>}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingTop: 56 },
  filtros: { marginBottom: 4 },
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
  titulo: { fontSize: 15, fontWeight: 'bold' },
  data: { fontSize: 13, color: '#6b7280' },
  email: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 4 },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  motivo: { fontSize: 13, color: '#dc2626', marginTop: 4 },
  maisBotao: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  maisTexto: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
});