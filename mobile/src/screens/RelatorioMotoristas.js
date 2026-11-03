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
const numero = (n) => separar(String(Math.round(n)));
const litrosFmt = (n) => {
  const [inteiro, decimal] = String(Number(n)).split('.');
  return separar(inteiro) + (decimal ? `,${decimal}` : '');
};
const consumoFmt = (n) => String(n).replace('.', ',');
const moeda = (n) => 'R$ ' + separar(Number(n).toFixed(2).replace('.', ','));

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

// Uma linha "rótulo ........ valor" do cartão do motorista.
function Linha({ rotulo, valor }) {
  return (
    <View style={styles.linhaDado}>
      <Text style={styles.rotuloDado}>{rotulo}</Text>
      <Text style={styles.valorDado}>{valor}</Text>
    </View>
  );
}

export default function RelatorioMotoristas() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setDados(await api(`/relatorios/motoristas?dias=${dias}`));
    } catch (e) {
      setErro('Não foi possível carregar o relatório. Verifique se o servidor está ligado.');
    } finally {
      setAtualizando(false);
    }
  }, [dias]);

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
      <Cabecalho titulo="RELATÓRIO DE MOTORISTAS" />

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
            <Cartao titulo="Motoristas" valor={dados.resumo.motoristas} />
            <Cartao titulo="Com atividade" valor={dados.resumo.com_atividade} />
            <Cartao titulo="Litros" valor={numero(dados.resumo.total_litros)} />
          </View>

          {dados.motoristas.length === 0 && <Text style={styles.vazio}>Nenhum motorista cadastrado.</Text>}

          {dados.motoristas.map((m) => (
            <View key={m.motorista_id} style={styles.caixa}>
              <Text style={styles.nome}>{m.nome}</Text>
              <Text style={styles.placas}>
                {m.placas.length > 0 ? m.placas.join(' · ') : 'Sem abastecimentos no período'}
              </Text>

              <Linha rotulo="Abastecimentos" valor={m.abastecimentos} />
              <Linha rotulo="Litros abastecidos" valor={`${litrosFmt(m.litros)} L`} />
              <Linha rotulo="Km rodados" valor={`${numero(m.km_rodados)} km`} />
              <Linha
                rotulo="Consumo médio"
                valor={m.consumo_km_l != null ? `${consumoFmt(m.consumo_km_l)} km/L` : '—'}
              />
              <Linha rotulo="Lavagens" valor={m.lavagens} />
              <Linha
                rotulo="Manutenções"
                valor={m.manutencoes > 0 ? `${m.manutencoes} · ${moeda(m.gasto_manutencao)}` : '0'}
              />
            </View>
          ))}

          <Text style={styles.nota}>
            Consumo = km rodados ÷ litros, considerando só caminhões com 2 ou mais abastecimentos no período.
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
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 30 },
  linha: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cartao: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center' },
  cartaoValor: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  cartaoTitulo: { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  nome: { fontSize: 17, fontWeight: 'bold', color: '#111827' },
  placas: { fontSize: 13, color: '#6b7280', marginTop: 2, marginBottom: 8 },
  linhaDado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  rotuloDado: { fontSize: 14, color: '#6b7280' },
  valorDado: { fontSize: 14, fontWeight: '600', color: '#111827' },
  nota: { fontSize: 12, color: '#6b7280', marginTop: 8 },
});