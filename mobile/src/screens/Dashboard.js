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
import Cabecalho from '../components/Cabecalho';

// Funções de formatação: 15000 -> "15.000" | 6350 -> "R$ 6.350,00" | "2026-10-16" -> "16/10/2026"
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));
const moeda = (n) => 'R$ ' + separar(Number(n).toFixed(2).replace('.', ','));
const dataBR = (d) => d.split('-').reverse().join('/');

// Períodos que o painel oferece.
const PERIODOS = [7, 30, 90];

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

// Barra de nível de um tanque (verde; vermelha quando está baixo).
function NivelTanque({ tanque, destaque }) {
  return (
    <View style={[styles.caixa, destaque && styles.caixaDestaque]}>
      <View style={styles.topoTanque}>
        <Text style={destaque ? styles.nomeDestaque : styles.nomeItem}>
          {tanque.nome} · {tanque.tipo_combustivel}
        </Text>
        {tanque.alerta && <Text style={styles.alerta}>NÍVEL BAIXO</Text>}
      </View>
      <View style={[styles.barraFundo, destaque && { height: 16, borderRadius: 8 }]}>
        <View
          style={[
            styles.barra,
            destaque && { height: 16 },
            {
              width: `${Math.min(tanque.percentual, 100)}%`,
              backgroundColor: tanque.alerta ? '#dc2626' : '#16a34a',
            },
          ]}
        />
      </View>
      <Text style={styles.detalhe}>
        {numero(tanque.nivel_atual)} L de {numero(tanque.capacidade)} L (
        {String(tanque.percentual).replace('.', ',')}%)
      </Text>
      {tanque.custo_medio != null && (
        <Text style={styles.custo}>
          Custo médio: R$ {Number(tanque.custo_medio).toFixed(2).replace('.', ',')}/L
        </Text>
      )}
    </View>
  );
}

export default function Dashboard() {
  const [dias, setDias] = useState(30);                  // período escolhido no filtro
  const [dados, setDados] = useState(null);              // resposta da API
  const [erro, setErro] = useState(null);                // mensagem de erro, se houver
  const [atualizando, setAtualizando] = useState(false); // controla o "puxar para atualizar"

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setDados(await api(`/dashboard?dias=${dias}`)); // o token é enviado automaticamente pelo api()
    } catch (e) {
      setErro('Não foi possível carregar os dados. Verifique se o servidor está ligado.');
    } finally {
      setAtualizando(false);
    }
  }, [dias]);

  // Recarrega toda vez que a aba é aberta ou que o período muda.
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
      <Cabecalho titulo="PAINEL DA FROTA" />

      {/* Filtro de período */}
      <View style={styles.periodos}>
        {PERIODOS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setDias(p)}
            style={[styles.periodo, dias === p && styles.periodoAtivo]}
          >
            <Text style={[styles.periodoTexto, dias === p && { color: '#fff' }]}>{p} dias</Text>
          </Pressable>
        ))}
      </View>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {!dados && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      {dados && (
        <>
          <View style={styles.linha}>
            <Cartao titulo={`Litros abastecidos (${dados.dias} dias)`} valor={numero(dados.litros_abastecidos)} />
            <Cartao titulo={`Litros comprados (${dados.dias} dias)`} valor={numero(dados.litros_comprados)} />
          </View>
          <View style={styles.linha}>
            <Cartao titulo={`Gasto com combustível (${dados.dias} dias)`} valor={moeda(dados.gasto_combustivel)} />
            <Cartao titulo={`Gasto com manutenção (${dados.dias} dias)`} valor={moeda(dados.gasto_manutencao)} />
          </View>

          {dados.tanque_principal && (
            <>
              <Text style={styles.secao}>Tanque principal</Text>
              <NivelTanque tanque={dados.tanque_principal} destaque />
            </>
          )}

          {dados.outros_tanques.length > 0 && (
            <>
              <Text style={styles.secao}>Outros tanques</Text>
              {dados.outros_tanques.map((t) => (
                <NivelTanque key={t.id} tanque={t} />
              ))}
            </>
          )}

          <Text style={styles.secao}>Últimos abastecimentos</Text>
          {dados.ultimos_abastecimentos.length === 0 && (
            <Text style={styles.vazio}>Nenhum abastecimento registrado.</Text>
          )}
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

          <Text style={styles.secao}>Últimas notas fiscais</Text>
          {dados.ultimas_notas_fiscais.length === 0 && (
            <Text style={styles.vazio}>Nenhuma nota fiscal cadastrada.</Text>
          )}
          {dados.ultimas_notas_fiscais.map((n) => (
            <View key={n.id} style={styles.caixa}>
              <View style={styles.topoTanque}>
                <Text style={styles.nomeItem}>NF {n.numero}</Text>
                <Text style={styles.nomeItem}>{moeda(n.valor_total)}</Text>
              </View>
              <Text style={styles.detalhe}>
                {n.fornecedor} · {dataBR(n.data_emissao)}
              </Text>
              <Text style={styles.detalhe}>{n.descricao}</Text>
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
    marginBottom: 12,
  },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  sair: { fontSize: 16, fontWeight: '600', color: '#2563eb' },
  periodos: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  periodo: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  periodoAtivo: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  periodoTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  vazio: { color: '#6b7280', marginBottom: 8 },
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
  caixaDestaque: { borderWidth: 2, borderColor: '#2563eb', padding: 16 },
  topoTanque: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  nomeItem: { fontSize: 15, fontWeight: '600', color: '#111827' },
  nomeDestaque: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  alerta: { color: '#dc2626', fontWeight: 'bold', fontSize: 12 },
  barraFundo: { height: 10, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden' },
  barra: { height: 10 },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 6 },
  custo: { fontSize: 13, color: '#2563eb', marginTop: 4, fontWeight: '500' },
});