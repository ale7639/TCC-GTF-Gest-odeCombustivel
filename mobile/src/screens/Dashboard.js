import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import Cabecalho from '../components/Cabecalho';
import SecaoRecolhivel from '../components/SecaoRecolhivel';
import { cores } from '../ui/tema';

const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));
const moeda = (n) => 'R$ ' + separar(Number(n).toFixed(2).replace('.', ','));
const dataBR = (d) => d.split('-').reverse().join('/');

function Secao({ titulo, aberta, onToggle }) {
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
              backgroundColor: tanque.alerta ? cores.perigo : cores.primaria,
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

// PAINEL
export default function Dashboard() {
  const navegacao = useNavigation();
  const { usuario } = useAuth();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [abertos, setAbertos] = useState({ abastecimentos: true, notas: true });
  const alternar = useCallback((chave) => {
    setAbertos((atual) => ({ ...atual, [chave]: !atual[chave] }));
  }, []);

  const ir = useCallback((rota) => navegacao.navigate(rota), [navegacao]);
  const primeiroNome = (usuario?.nome || 'gestor').split(' ')[0];
  const pendentes = (dados?.pendentes ?? 0) + (dados?.pedidos_senha ?? 0);
  const pedidosSenha = dados?.solicitacoes_senha ?? [];

  // PAINEL CARREGAR — GET /dashboard?dias=30
  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setDados(await api('/dashboard?dias=30'));
    } catch (e) {
      setErro('Não foi possível carregar os dados. Verifique se o servidor está ligado.');
    } finally {
      setAtualizando(false);
    }
  }, []);

  // Recarrega toda vez que a aba é aberta ou que o período muda.
  // Enquanto o Painel está aberto, confere de novo a cada 30 segundos, para o sino
  // mostrar na hora os abastecimentos que os motoristas enviarem. Ao sair da tela, para.
  useFocusEffect(
    useCallback(() => {
      carregar();
      const relogio = setInterval(carregar, 30000);
      return () => clearInterval(relogio);
    }, [carregar])
  );

  const pendentes = dados?.pendentes ?? 0; // lançamentos de motoristas aguardando aprovação

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
      <Cabecalho titulo="PAINEL DA FROTA">
        {/* Sino: mostra quantos lançamentos aguardam aprovação; ao tocar, abre Aprovações */}
        <Pressable
          onPress={() => navegacao.navigate('Aprovacoes')}
          hitSlop={8}
          accessibilityLabel={`${pendentes} lançamentos aguardando aprovação`}
        >
          <MaterialCommunityIcons name={pendentes > 0 ? 'bell-ring' : 'bell-outline'} size={26} color="#fff" />
          {pendentes > 0 && (
            <View style={styles.selo}>
              <Text style={styles.seloTexto}>{pendentes > 9 ? '9+' : pendentes}</Text>
            </View>
          )}
        </Pressable>
      </Cabecalho>

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
          {dados.pendentes > 0 && (
            <Pressable style={styles.pendencias} onPress={() => navegacao.navigate('Aprovacoes')}>
              <Text style={styles.pendenciasTexto}>
                {dados.pendentes} {dados.pendentes === 1 ? 'lançamento aguarda' : 'lançamentos aguardam'} aprovação · Ver
              </Text>
            </Pressable>
          )}

          {/* Atalho para a tarefa mais comum do sistema */}
          <Pressable
            style={styles.botaoAbastecer}
            onPress={() => navegacao.navigate('Abastecimentos', { novo: Date.now() })}
          >
            <Text style={styles.botaoAbastecerTexto}>+  Abastecer caminhão</Text>
          </Pressable>

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

          {/* Seções que abrem e fecham ao tocar no título (começam fechadas para o Painel ficar limpo) */}
          {dados.outros_tanques.length > 0 && (
            <SecaoRecolhivel titulo="Outros tanques" quantidade={dados.outros_tanques.length}>
              {dados.outros_tanques.map((t) => (
                <NivelTanque key={t.id} tanque={t} />
              ))}
            </SecaoRecolhivel>
          )}

          <SecaoRecolhivel titulo="Últimos abastecimentos" quantidade={dados.ultimos_abastecimentos.length}>
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
          </SecaoRecolhivel>

          <SecaoRecolhivel titulo="Últimas notas fiscais" quantidade={dados.ultimas_notas_fiscais.length}>
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
          </SecaoRecolhivel>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titulo: { fontSize: 24, fontWeight: 'bold', color: cores.texto },
  sair: { fontSize: 16, fontWeight: '600', color: cores.primaria },
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
  pendencias: { backgroundColor: cores.primariaClara, borderRadius: 12, padding: 12, marginBottom: 8 },
  pendenciasTexto: { color: cores.primariaEscura, fontWeight: '600', fontSize: 14 },
  vazio: { color: cores.textoSecundario, marginBottom: 8 },
  linha: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  cartao: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: RAIO_CARTAO,
    padding: 16,
    minHeight: 88,
    justifyContent: 'center',
    ...sombraSuave},
  numero: { fontSize: 26, fontWeight: '700', color: TEXTO },
  rotuloCard: { fontSize: 13, color: TEXTO_SUAVE, marginTop: 4 },
  hojeLinha: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  hojeBloco: { flex: 1 },
  hojeDivisor: { width: 1, height: 40, backgroundColor: '#e5e7eb', marginHorizontal: 12 },
  cta: {
    backgroundColor: VERMELHO,
    borderRadius: 12,
    paddingVertical: 16,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartaoValor: { fontSize: 22, fontWeight: 'bold', color: cores.texto },
  cartaoTitulo: { fontSize: 12, color: cores.textoSecundario, marginTop: 4, textAlign: 'center' },
  botaoAbastecer: {
    backgroundColor: cores.primaria,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  botaoAbastecerTexto: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  secao: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8, color: cores.texto },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  caixaDestaque: { borderWidth: 2, borderColor: cores.primaria, padding: 16 },
  topoTanque: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  nomeItem: { fontSize: 15, fontWeight: '600', color: cores.texto },
  nomeDestaque: { fontSize: 18, fontWeight: 'bold', color: cores.texto },
  alerta: { color: cores.perigo, fontWeight: 'bold', fontSize: 12 },
  barraFundo: { height: 10, backgroundColor: cores.bordaClara, borderRadius: 5, overflow: 'hidden' },
  barra: { height: 10 },
  detalhe: { fontSize: 13, color: cores.textoSecundario, marginTop: 6 },
  custo: { fontSize: 13, color: cores.primaria, marginTop: 4, fontWeight: '500' },
  // Bolinha com o número em cima do sino.
  selo: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seloTexto: { color: cores.primaria, fontSize: 11, fontWeight: 'bold' },
});