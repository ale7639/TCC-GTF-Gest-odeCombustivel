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

// Iniciais do nome para o "avatar": "João Pedro Almeida" -> "JA".
const iniciais = (nome) => {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
};

// Um número pequeno com o rótulo embaixo (a grade de 3 colunas do cartão).
function Indicador({ valor, rotulo }) {
  return (
    <View style={styles.indicador}>
      <Text style={styles.indicadorValor} numberOfLines={1}>
        {valor}
      </Text>
      <Text style={styles.indicadorRotulo}>{rotulo}</Text>
    </View>
  );
}

export default function RelatorioMotoristas() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [busca, setBusca] = useState(''); // filtra os cartões por nome do motorista ou placa
  const navegacao = useNavigation();

  // Toque no cartão: abre os abastecimentos desse motorista, no mesmo período do relatório.
  // "chave" muda a cada toque, para a outra tela aplicar o filtro mesmo se for o mesmo motorista.
  const verAbastecimentos = (nome) =>
    navegacao.navigate('Abastecimentos', { filtro: { busca: nome, dias, tanqueId: null, chave: Date.now() } });

  // Busca sem diferenciar maiúsculas, acentos, traço ou espaço: "joao" acha "João".
  const normalizar = (t) =>
    String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

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

  const termo = normalizar(busca);
  const filtrados = dados
    ? dados.motoristas.filter(
        (m) => !termo || normalizar(m.nome).includes(termo) || m.placas.some((pl) => normalizar(pl).includes(termo))
      )
    : [];

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

          {dados.motoristas.length > 0 && (
            <>
              <View style={styles.busca}>
                <MaterialCommunityIcons name="magnify" size={20} color={cores.textoSecundario} />
                <TextInput
                  style={styles.buscaCampo}
                  placeholder="Buscar motorista ou placa"
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
              {busca.trim() !== '' && (
                <Text style={styles.contagem}>
                  {filtrados.length} de {dados.motoristas.length} motoristas
                </Text>
              )}
              {busca.trim() !== '' && filtrados.length === 0 && (
                <Text style={styles.vazio}>Nenhum motorista encontrado para "{busca}".</Text>
              )}
            </>
          )}

          {filtrados.map((m) => (
            <Pressable key={m.motorista_id} style={styles.caixa} onPress={() => verAbastecimentos(m.nome)}>
              {/* Topo: iniciais + nome e placas + consumo em destaque */}
              <View style={styles.topoMotorista}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarTexto}>{iniciais(m.nome)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nome} numberOfLines={1}>
                    {m.nome}
                  </Text>
                  <Text style={styles.placas} numberOfLines={1}>
                    {m.placas.length > 0 ? m.placas.join(' · ') : 'Sem abastecimentos no período'}
                  </Text>
                </View>
                <View style={styles.consumo}>
                  <Text style={styles.consumoValor}>
                    {m.consumo_km_l != null ? consumoFmt(m.consumo_km_l) : '—'}
                  </Text>
                  <Text style={styles.consumoRotulo}>km/L</Text>
                </View>
              </View>

              {/* Grade com os números do período */}
              <View style={styles.grade}>
                <Indicador valor={m.abastecimentos} rotulo="Abastecimentos" />
                <Indicador valor={`${litrosFmt(m.litros)} L`} rotulo="Litros" />
                <Indicador valor={`${numero(m.km_rodados)} km`} rotulo="Rodados" />
                <Indicador valor={m.lavagens} rotulo="Lavagens" />
                <Indicador valor={m.manutencoes} rotulo="Manutenções" />
                <Indicador valor={m.gasto_manutencao > 0 ? moeda(m.gasto_manutencao) : '—'} rotulo="Gasto manutenção" />
              </View>
              {m.abastecimentos > 0 && <Text style={styles.verMais}>Ver abastecimentos ›</Text>}
            </Pressable>
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
  vazio: { textAlign: 'center', color: cores.textoSecundario, marginTop: 30 },
  linha: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cartao: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center' },
  cartaoValor: { fontSize: 22, fontWeight: 'bold', color: cores.texto },
  cartaoTitulo: { fontSize: 12, color: cores.textoSecundario, marginTop: 4, textAlign: 'center' },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  topoMotorista: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: cores.primariaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { color: cores.primaria, fontWeight: 'bold', fontSize: 15 },
  nome: { fontSize: 16, fontWeight: 'bold', color: cores.texto },
  placas: { fontSize: 13, color: cores.textoSecundario, marginTop: 2 },
  consumo: { alignItems: 'center', backgroundColor: cores.primaria, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  consumoValor: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  consumoRotulo: { color: '#fff', fontSize: 11 },
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: cores.bordaClara,
  },
  indicador: { width: '33.33%', alignItems: 'center', paddingVertical: 8 },
  indicadorValor: { fontSize: 15, fontWeight: 'bold', color: cores.texto },
  indicadorRotulo: { fontSize: 11, color: cores.textoSecundario, marginTop: 2, textAlign: 'center' },
  nota: { fontSize: 12, color: cores.textoSecundario, marginTop: 8 },
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
  verMais: { fontSize: 12, fontWeight: '600', color: cores.primaria, marginTop: 4, textAlign: 'right' },
});