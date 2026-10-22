import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';

// Funções de formatação: 15000 -> "15.000" | 6350 -> "R$ 6.350,00" | "2026-10-16" -> "16/10/2026"
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));
const moeda = (n) => 'R$ ' + separar(Number(n).toFixed(2).replace('.', ','));
const dataBR = (d) => d.split('-').reverse().join('/');

// Cartão pequeno com um número em destaque.
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

export default function Dashboard() {
  const { sair } = useAuth();
  const [dados, setDados] = useState(null);              // resposta da API
  const [erro, setErro] = useState(null);                // mensagem de erro, se houver
  const [atualizando, setAtualizando] = useState(false); // controla o "puxar para atualizar"

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setDados(await api('/dashboard')); // o token é enviado automaticamente pelo api()
    } catch (e) {
      setErro('Não foi possível carregar os dados. Verifique se o servidor está ligado.');
    } finally {
      setAtualizando(false);
    }
  }, []);

  // Recarrega os dados toda vez que a aba é aberta (assim reflete cadastros feitos em outras telas).
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  return (
    <ScrollView
      style={styles.tela}
      contentContainerStyle={styles.conteudo}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={() => {
            setAtualizando(true);
            carregar();
          }}
        />
      }
    >
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>Painel da Frota</Text>
        <Pressable onPress={sair}>
          <Text style={styles.sair}>Sair</Text>
        </Pressable>
      </View>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {!dados && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      {dados && (
        <>
          <View style={styles.linha}>
            <Cartao titulo="Caminhões" valor={dados.caminhoes.total} />
            <Cartao titulo="Ativos" valor={dados.caminhoes.ativos} />
            <Cartao titulo="Em manutenção" valor={dados.caminhoes.em_manutencao} />
          </View>

          <View style={styles.linha}>
            <Cartao titulo="Litros (30 dias)" valor={numero(dados.litros_abastecidos_30_dias)} />
            <Cartao titulo="Manutenção (30 dias)" valor={moeda(dados.gasto_manutencao_30_dias)} />
          </View>

          <Text style={styles.secao}>Tanques</Text>
          {dados.tanques.map((t) => (
            <View key={t.id} style={styles.caixa}>
              <View style={styles.topoTanque}>
                <Text style={styles.nomeItem}>
                  {t.nome} · {t.tipo_combustivel}
                </Text>
                {t.alerta && <Text style={styles.alerta}>NÍVEL BAIXO</Text>}
              </View>
              <View style={styles.barraFundo}>
                <View
                  style={[
                    styles.barra,
                    {
                      width: `${Math.min(t.percentual, 100)}%`,
                      backgroundColor: t.alerta ? '#dc2626' : '#16a34a',
                    },
                  ]}
                />
              </View>
              <Text style={styles.detalhe}>
                {numero(t.nivel_atual)} L de {numero(t.capacidade)} L ({t.percentual}%)
              </Text>
            </View>
          ))}

          <Text style={styles.secao}>Últimos abastecimentos</Text>
          {dados.ultimos_abastecimentos.map((a) => (
            <View key={a.id} style={styles.caixa}>
              <Text style={styles.nomeItem}>
                {a.placa} · {numero(a.litros)} L
              </Text>
              <Text style={styles.detalhe}>
                {a.motorista} · {a.tanque} · {dataBR(a.data)}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f3f4f6' },
  conteudo: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  sair: { fontSize: 16, fontWeight: '600', color: '#2563eb' },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  linha: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  cartao: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  cartaoValor: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  cartaoTitulo: { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  secao: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8, color: '#111827' },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  topoTanque: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  nomeItem: { fontSize: 15, fontWeight: '600', color: '#111827' },
  alerta: { color: '#dc2626', fontWeight: 'bold', fontSize: 12 },
  barraFundo: { height: 10, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden' },
  barra: { height: 10 },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 6 },
});