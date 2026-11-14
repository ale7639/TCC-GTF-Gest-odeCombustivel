import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import { cores } from '../ui/tema';

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
  const [busca, setBusca] = useState(''); // filtra a lista "Por caminhão" (placa, modelo ou motorista)
  const [tanqueId, setTanqueId] = useState(null); // null = todos os tanques
  const navegacao = useNavigation();

  // Toque no cartão do caminhão: abre a lista de abastecimentos dele, no mesmo período e tanque.
  // "chave" muda a cada toque, para a outra tela aplicar o filtro mesmo se for a mesma placa.
  const verAbastecimentos = (placa) =>
    navegacao.navigate('Abastecimentos', { filtro: { busca: placa, dias, tanqueId, chave: Date.now() } });

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setDados(await api(`/relatorios/abastecimentos?dias=${dias}${tanqueId ? `&tanque_id=${tanqueId}` : ''}`));
    } catch (e) {
      setErro('Não foi possível carregar o relatório. Verifique se o servidor está ligado.');
    } finally {
      setAtualizando(false);
    }
  }, [dias, tanqueId]);

  // Recarrega ao abrir a tela e quando o período muda.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const maxCaminhao = dados ? Math.max(0, ...dados.por_caminhao.map((c) => c.litros)) : 0;

  // Busca sem diferenciar maiúsculas, acentos, traço ou espaço: "abc-1d" acha "ABC1D23".
  const normalizar = (t) =>
    String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const termo = normalizar(busca);
  const caminhoesFiltrados = dados
    ? dados.por_caminhao.filter(
        (c) =>
          !termo ||
          normalizar(c.placa).includes(termo) ||
          normalizar(c.modelo).includes(termo) ||
          normalizar(c.motorista).includes(termo)
      )
    : [];
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

      {/* Filtro por tanque: tudo abaixo passa a contar só o que saiu do tanque escolhido */}
      {dados?.tanques?.length > 0 && (
        <View style={styles.tanques}>
          {[{ id: null, nome: 'Todos os tanques' }, ...dados.tanques].map((t) => (
            <Pressable
              key={t.id ?? 'todos'}
              onPress={() => setTanqueId(t.id)}
              style={[styles.chip, tanqueId === t.id && styles.chipAtivo]}
            >
              <Text style={[styles.chipTexto, tanqueId === t.id && { color: '#fff' }]}>{t.nome}</Text>
            </Pressable>
          ))}
        </View>
      )}

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

          {dados.por_caminhao.length > 0 && (
            <>
              <View style={styles.busca}>
                <MaterialCommunityIcons name="magnify" size={20} color={cores.textoSecundario} />
                <TextInput
                  style={styles.buscaCampo}
                  placeholder="Buscar placa, modelo ou motorista"
                  value={busca}
                  onChangeText={setBusca}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {busca !== '' && (
                  <Pressable onPress={() => setBusca('')} hitSlop={8}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={cores.textoClaro} />
                  </Pressable>
                )}
              </View>
              {termo !== '' && (
                <Text style={styles.contagem}>
                  {caminhoesFiltrados.length} de {dados.por_caminhao.length} caminhões
                </Text>
              )}
              {termo !== '' && caminhoesFiltrados.length === 0 && (
                <Text style={styles.vazio}>Nenhum caminhão encontrado para "{busca}".</Text>
              )}
            </>
          )}

          {caminhoesFiltrados.map((c) => (
            <Pressable key={c.caminhao_id} style={styles.caixa} onPress={() => verAbastecimentos(c.placa)}>
              <View style={styles.topo}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nomeItem}>
                    {c.placa} · {c.modelo}
                  </Text>
                  {c.motorista ? <Text style={styles.motorista}>{c.motorista}</Text> : null}
                </View>
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
              <Text style={styles.verMais}>Ver abastecimentos ›</Text>
            </Pressable>
          ))}

          <Text style={styles.secao}>Por tanque</Text>
          {dados.por_tanque.map((t) => (
            <Pressable key={t.tanque_id} style={styles.caixa} onPress={() => setTanqueId(t.tanque_id)}>
              <View style={styles.topo}>
                <Text style={styles.nomeItem}>{t.nome}</Text>
                <Text style={styles.destaque}>{litrosFmt(t.litros)} L</Text>
              </View>
              <Barra parte={t.litros} maximo={maxTanque} />
              <Text style={styles.detalhe}>
                {t.abastecimentos} {t.abastecimentos === 1 ? 'abastecimento' : 'abastecimentos'}
              </Text>
            </Pressable>
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
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 16, paddingTop: 56, paddingBottom: 40 },
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
  erro: { color: cores.perigo, marginTop: 20, textAlign: 'center' },
  vazio: { color: cores.textoSecundario, marginBottom: 8 },
  linha: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  cartao: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  cartaoValor: { fontSize: 22, fontWeight: 'bold', color: cores.texto },
  cartaoTitulo: { fontSize: 12, color: cores.textoSecundario, marginTop: 4, textAlign: 'center' },
  secao: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8, color: cores.texto },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  nomeItem: { fontSize: 15, fontWeight: '600', color: cores.texto, flexShrink: 1, marginRight: 8 },
  destaque: { fontSize: 15, fontWeight: 'bold', color: cores.primaria },
  barraFundo: { height: 8, backgroundColor: cores.bordaClara, borderRadius: 4, overflow: 'hidden' },
  barra: { height: 8, backgroundColor: cores.primaria },
  detalhe: { fontSize: 13, color: cores.textoSecundario, marginTop: 6 },
  nota: { fontSize: 12, color: cores.textoClaro, marginTop: 4 },
  rodape: { fontSize: 12, color: cores.textoSecundario, marginTop: 16, lineHeight: 18 },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  buscaCampo: { flex: 1, paddingVertical: 10, fontSize: 15 },
  contagem: { fontSize: 12, color: cores.textoSecundario, marginBottom: 8 },
  tanques: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
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
  motorista: { fontSize: 12, color: cores.textoSecundario, marginTop: 1 },
  verMais: { fontSize: 12, fontWeight: '600', color: cores.primaria, marginTop: 6, textAlign: 'right' },
});