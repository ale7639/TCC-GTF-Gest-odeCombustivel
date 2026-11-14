// Relatório de caminhões: escolhe um caminhão e mostra tudo o que foi feito nele no período
// (abastecimentos, manutenções, lavagens e notas fiscais), com um resumo de gastos.
// API: GET /caminhoes (lista para a busca) e GET /relatorios/caminhoes/{id}?dias=
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import SeletorCaminhao from '../components/SeletorCaminhao';
import { cores } from '../ui/tema';

// ---------- Formatação ----------
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));
const moeda = (n) => 'R$ ' + separar(Number(n).toFixed(2).replace('.', ','));
const litrosFmt = (n) => {
  const [inteiro, decimal] = String(Number(n)).split('.');
  return separar(inteiro) + (decimal ? `,${decimal}` : '');
};

const PERIODOS = [
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
  [0, 'Tudo'],
];

// Filtros da linha do tempo: [valor, rótulo]. null = todos os tipos.
const TIPOS = [
  [null, 'Tudo'],
  ['abastecimento', 'Abastecimentos'],
  ['manutencao', 'Manutenções'],
  ['lavagem', 'Lavagens'],
  ['nota', 'Notas'],
];

// Ícone de cada tipo de registro.
const ICONE = { abastecimento: 'gas-station', manutencao: 'wrench', lavagem: 'car-wash', nota: 'file-document-outline' };

const STATUS = { ativo: 'Ativo', manutencao: 'Em manutenção', inativo: 'Inativo' };

// Um número pequeno com o rótulo embaixo (grade de 3 colunas do resumo).
function Indicador({ valor, rotulo, destaque }) {
  return (
    <View style={styles.indicador}>
      <Text style={[styles.indicadorValor, destaque && { color: cores.primaria }]} numberOfLines={1}>
        {valor}
      </Text>
      <Text style={styles.indicadorRotulo}>{rotulo}</Text>
    </View>
  );
}

function Chip({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.chip, ativo && styles.chipAtivo]}>
      <Text style={[styles.chipTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

export default function RelatorioCaminhoes() {
  const [caminhoes, setCaminhoes] = useState([]); // lista para a busca
  const [caminhaoId, setCaminhaoId] = useState(null); // caminhão escolhido
  const [dias, setDias] = useState(30);
  const [tipo, setTipo] = useState(null); // filtro da linha do tempo
  const [dados, setDados] = useState(null); // resposta do relatório
  const [carregando, setCarregando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);

  // Lista de caminhões: recarrega sempre que a tela é aberta.
  useFocusEffect(
    useCallback(() => {
      api('/caminhoes').then(setCaminhoes).catch(() => setErro('Não foi possível carregar os caminhões.'));
    }, [])
  );

  // Busca o relatório do caminhão escolhido, no período escolhido.
  const carregar = useCallback(async () => {
    if (!caminhaoId) return;
    try {
      setErro(null);
      setCarregando(true);
      setDados(await api(`/relatorios/caminhoes/${caminhaoId}?dias=${dias}`));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [caminhaoId, dias]);

  // Roda de novo sempre que o caminhão ou o período mudam.
  useEffect(() => {
    carregar();
  }, [carregar]);

  const historico = dados ? dados.historico.filter((i) => !tipo || i.tipo === tipo) : [];
  const r = dados?.resumo;

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
      <Cabecalho titulo="RELATÓRIO DE CAMINHÕES" />

      <Text style={styles.rotulo}>Caminhão</Text>
      <SeletorCaminhao
        caminhoes={caminhoes}
        selecionadoId={caminhaoId}
        aoEscolher={(c) => {
          setTipo(null);
          setCaminhaoId(c.id);
        }}
        vazio="Nenhum caminhão cadastrado."
      />

      {!caminhaoId && (
        <Text style={styles.vazio}>Escolha um caminhão para ver tudo o que foi feito nele.</Text>
      )}

      {caminhaoId && (
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
      )}

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && !dados && <ActivityIndicator size="large" style={{ marginTop: 30 }} />}

      {dados && caminhaoId && (
        <>
          {/* Ficha do caminhão */}
          <View style={styles.caixa}>
            <View style={styles.linhaTopo}>
              <Text style={styles.placa}>{dados.caminhao.placa}</Text>
              <Text style={styles.status}>{STATUS[dados.caminhao.status] ?? dados.caminhao.status}</Text>
            </View>
            <Text style={styles.detalhe}>
              {dados.caminhao.modelo} · {dados.caminhao.ano}
            </Text>
            <Text style={styles.detalhe}>
              {numero(dados.caminhao.km_atual)} km · tanque de {numero(dados.caminhao.capacidade_tanque)} L ·{' '}
              {dados.caminhao.motorista ?? 'sem motorista'}
            </Text>
          </View>

          {/* Resumo do período */}
          <View style={styles.caixa}>
            <Text style={styles.secaoCaixa}>Resumo do período</Text>
            <View style={styles.grade}>
              <Indicador valor={r.abastecimentos} rotulo="Abastecimentos" />
              <Indicador valor={`${litrosFmt(r.litros)} L`} rotulo="Litros" />
              <Indicador
                valor={r.consumo_km_l != null ? `${String(r.consumo_km_l).replace('.', ',')}` : '—'}
                rotulo="Consumo km/L"
                destaque
              />
              <Indicador valor={`${numero(r.km_rodados)} km`} rotulo="Rodados" />
              <Indicador valor={r.manutencoes} rotulo="Manutenções" />
              <Indicador valor={r.lavagens} rotulo="Lavagens" />
            </View>

            <View style={styles.gastos}>
              <View style={styles.gastoLinha}>
                <Text style={styles.gastoRotulo}>Combustível</Text>
                <Text style={styles.gastoValor}>{moeda(r.gasto_combustivel)}</Text>
              </View>
              <View style={styles.gastoLinha}>
                <Text style={styles.gastoRotulo}>Manutenções</Text>
                <Text style={styles.gastoValor}>{moeda(r.gasto_manutencao)}</Text>
              </View>
              <View style={styles.gastoLinha}>
                <Text style={styles.gastoRotulo}>Outras notas ({r.notas})</Text>
                <Text style={styles.gastoValor}>{moeda(r.gasto_notas)}</Text>
              </View>
              <View style={[styles.gastoLinha, styles.gastoTotal]}>
                <Text style={styles.gastoTotalRotulo}>Gasto total</Text>
                <Text style={styles.gastoTotalValor}>{moeda(r.gasto_total)}</Text>
              </View>
            </View>
          </View>

          {/* Linha do tempo */}
          <Text style={styles.secao}>Histórico</Text>
          <View style={styles.chips}>
            {TIPOS.map(([valor, rotulo]) => (
              <Chip key={rotulo} texto={rotulo} ativo={tipo === valor} aoTocar={() => setTipo(valor)} />
            ))}
          </View>

          {historico.length === 0 && <Text style={styles.vazio}>Nenhum registro no período.</Text>}

          {historico.map((i) => (
            <View key={`${i.tipo}-${i.id}`} style={styles.item}>
              <View style={styles.icone}>
                <MaterialCommunityIcons name={ICONE[i.tipo]} size={20} color={cores.primaria} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.linhaTopo}>
                  <Text style={styles.itemTitulo} numberOfLines={1}>
                    {i.titulo}
                  </Text>
                  {i.valor != null && <Text style={styles.itemValor}>{moeda(i.valor)}</Text>}
                </View>
                <Text style={styles.detalhe}>{[i.data_br, ...i.linhas].join(' · ')}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  rotulo: { fontSize: 14, color: cores.textoMedio, marginBottom: 6, fontWeight: '500' },
  vazio: { textAlign: 'center', color: cores.textoSecundario, marginTop: 20 },
  erro: { color: cores.perigo, marginVertical: 10, textAlign: 'center' },

  periodos: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  periodo: {
    flex: 1,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  periodoAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  periodoTexto: { fontSize: 14, fontWeight: '600', color: cores.textoMedio },

  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  placa: { fontSize: 20, fontWeight: 'bold', color: cores.texto },
  status: { fontSize: 13, fontWeight: '600', color: cores.textoMedio },
  detalhe: { fontSize: 13, color: cores.textoSecundario, marginTop: 3 },

  secaoCaixa: { fontSize: 15, fontWeight: '600', color: cores.texto, marginBottom: 4 },
  grade: { flexDirection: 'row', flexWrap: 'wrap' },
  indicador: { width: '33.33%', alignItems: 'center', paddingVertical: 8 },
  indicadorValor: { fontSize: 15, fontWeight: 'bold', color: cores.texto },
  indicadorRotulo: { fontSize: 11, color: cores.textoSecundario, marginTop: 2, textAlign: 'center' },

  gastos: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: cores.bordaClara },
  gastoLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  gastoRotulo: { fontSize: 14, color: cores.textoSecundario },
  gastoValor: { fontSize: 14, fontWeight: '600', color: cores.texto },
  gastoTotal: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: cores.bordaClara },
  gastoTotalRotulo: { fontSize: 15, fontWeight: 'bold', color: cores.texto },
  gastoTotalValor: { fontSize: 15, fontWeight: 'bold', color: cores.primaria },

  secao: { fontSize: 18, fontWeight: '600', color: cores.texto, marginTop: 6, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
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

  item: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  icone: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: cores.primariaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitulo: { fontSize: 15, fontWeight: 'bold', color: cores.texto, flexShrink: 1 },
  itemValor: { fontSize: 14, fontWeight: '600', color: cores.texto },
});