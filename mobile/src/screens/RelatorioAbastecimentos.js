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

// Funções de formatação.
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));                 // 15000 -> "15.000"
const litrosFmt = (n) => {                                            // 273.5 -> "273,5"
  const [inteiro, decimal] = String(Number(n)).split('.');
  return separar(inteiro) + (decimal ? `,${decimal}` : '');
};
const consumoFmt = (n) => String(n).replace('.', ',');               // 3.25 -> "3,25"

// Períodos do filtro (0 = todo o período).
const PERIODOS = [
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
  [0, 'Tudo'],
];

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

// Barra proporcional (a maior da lista ocupa 100%).
function Barra({ parte, maximo }) {
  const largura = maximo > 0 ? Math.max(2, (parte / maximo) * 100) : 0;
  return (
    <View style={styles.barraFundo}>
      <View style={[styles.barra, { width: `${largura}%` }]} />
    </View>
  );
}

export default function RelatorioAbastecimentos() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setDados(await api(`/relatorios/abastecimentos?dias=${dias}`));
    } catch (e) {
      setErro('Não foi possível carregar o relatório. Verifique se o servidor está ligado.');
    } finally {
      setAtualizando(false);
    }
  }, [dias]);

  // Recarrega ao abrir a tela e quando o período muda.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const maxCaminhao = dados ? Math.max(0, ...dados.por_caminhao.map((c) => c.litros)) : 0;
  const maxTanque = dados ? Math.max(0, ...dados.por_tanque.map((t) => t.litros)) : 0;

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
      <Cabecalho titulo="RELATÓRIO DE ABASTECIMENTOS" />

      <View style={styles.periodos}>
        {PERIODOS.map(([valor, rotulo]) => (
          <Pressable
            key={valor}
            onPress={() => setDias(valor)}
            style={[styles.periodo, dias === valor && styles.periodoAtivo]}
          >
            <Text style={[styles.periodoTexto, dias === valor && { color: '#fff' }]}>{rotulo}</Text>
          </Pressable>
        ))}
      </View>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {!dados && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      {dados && (
        <>
          <View style={styles.linha}>
            <Cartao titulo="Litros abastecidos" valor={numero(dados.resumo.total_litros)} />
            <Cartao titulo="Abastecimentos" valor={dados.resumo.abastecimentos} />
          </View>
          <View style={styles.linha}>
            <Cartao titulo="Caminhões atendidos" valor={dados.resumo.caminhoes_atendidos} />
            <Cartao
              titulo="Consumo médio da frota"
              valor={
                dados.resumo.consumo_medio_km_l != null
                  ? `${consumoFmt(dados.resumo.consumo_medio_km_l)} km/L`
                  : '—'
              }
            />
          </View>

          <Text style={styles.secao}>Por caminhão</Text>
          {dados.por_caminhao.length === 0 && (
            <Text style={styles.vazio}>Nenhum abastecimento no período.</Text>
          )}
          {dados.por_caminhao.map((c) => (
            <View key={c.caminhao_id} style={styles.caixa}>
              <View style={styles.topo}>
                <Text style={styles.nomeItem}>
                  {c.placa} · {c.modelo}
                </Text>
                <Text style={styles.destaque}>
                  {c.consumo_km_l != null ? `${consumoFmt(c.consumo_km_l)} km/L` : '—'}
                </Text>
              </View>
              <Barra parte={c.litros} maximo={maxCaminhao} />
              <Text style={styles.detalhe}>
                {litrosFmt(c.litros)} L · {c.abastecimentos}{' '}
                {c.abastecimentos === 1 ? 'abastecimento' : 'abastecimentos'} · {numero(c.km_rodados)} km rodados
              </Text>
              {c.consumo_km_l == null && (
                <Text style={styles.nota}>Consumo precisa de pelo menos 2 abastecimentos no período.</Text>
              )}
            </View>
          ))}

          <Text style={styles.secao}>Por tanque</Text>
          {dados.por_tanque.map((t) => (
            <View key={t.tanque_id} style={styles.caixa}>
              <View style={styles.topo}>
                <Text style={styles.nomeItem}>{t.nome}</Text>
                <Text style={styles.destaque}>{litrosFmt(t.litros)} L</Text>
              </View>
              <Barra parte={t.litros} maximo={maxTanque} />
              <Text style={styles.detalhe}>
                {t.abastecimentos} {t.abastecimentos === 1 ? 'abastecimento' : 'abastecimentos'}
              </Text>
            </View>
          ))}

          <Text style={styles.rodape}>
            O consumo é estimado: km rodados entre o primeiro e o último abastecimento do período, divididos
            pelos litros colocados depois do primeiro. Considera que cada abastecimento completa o tanque.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f3f4f6' },
  conteudo: { padding: 16, paddingTop: 56, paddingBottom: 40 },
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
  topo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  nomeItem: { fontSize: 15, fontWeight: '600', color: '#111827', flexShrink: 1, marginRight: 8 },
  destaque: { fontSize: 15, fontWeight: 'bold', color: '#2563eb' },
  barraFundo: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  barra: { height: 8, backgroundColor: '#2563eb' },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 6 },
  nota: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  rodape: { fontSize: 12, color: '#6b7280', marginTop: 16, lineHeight: 18 },
});