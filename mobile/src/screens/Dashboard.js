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
import EstadoVazio from '../ui/EstadoVazio';
import Esqueleto from '../ui/Esqueleto';
import MensagemErro from '../ui/MensagemErro';
import {
  CINZA_FUNDO,
  RAIO_CARTAO,
  sombraSuave,
  TEXTO,
  TEXTO_SUAVE,
  VERDE,
  VERMELHO,
} from '../ui/tema';

// PAINEL — tela inicial do admin (tanque, frota, hoje, recentes).

const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));
const moeda = (n) => 'R$ ' + separar(Number(n).toFixed(2).replace('.', ','));
const dataBR = (d) => d.split('-').reverse().join('/');

function Secao({ titulo, aberta, onToggle }) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.secaoLinha, pressed && styles.pressionado]}
      accessibilityRole="button"
      accessibilityState={{ expanded: aberta }}
      accessibilityLabel={`${aberta ? 'Recolher' : 'Expandir'} ${titulo}`}
    >
      <Text style={styles.secao}>{titulo}</Text>
      <MaterialCommunityIcons
        name={aberta ? 'chevron-up' : 'chevron-down'}
        size={22}
        color={VERMELHO}
      />
    </Pressable>
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

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const frota = dados?.frota;
  const hoje = dados?.abastecimentos_hoje;
  const tanque = dados?.tanque_principal;
  const ultimos = dados?.ultimos_abastecimentos ?? [];
  const notas = dados?.ultimas_notas_fiscais ?? [];

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="Painel">
        <Pressable
          onPress={() => ir('Aprovacoes')}
          style={styles.sino}
          accessibilityRole="button"
          accessibilityLabel={
            pendentes > 0
              ? `Aprovações, ${pendentes} pendente${pendentes === 1 ? '' : 's'}`
              : 'Aprovações e alertas'
          }
          hitSlop={8}
        >
          <MaterialCommunityIcons name="bell-outline" size={24} color="#fff" />
          {pendentes > 0 && (
            <View style={styles.sinoBadge}>
              <Text style={styles.sinoBadgeTexto}>{pendentes > 9 ? '9+' : String(pendentes)}</Text>
            </View>
          )}
        </Pressable>
      </Cabecalho>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => {
              setAtualizando(true);
              carregar();
            }}
            tintColor={VERMELHO}
          />
        }
      >
        <Text style={styles.eyebrow}>Operação de hoje</Text>
        <Text style={styles.saudacao}>Olá, {primeiroNome}</Text>
        <Text style={styles.saudacaoSub}>Bem-vindo de volta</Text>

        {erro && (
          <MensagemErro
            titulo="Não foi possível carregar o painel"
            mensagem={erro}
            aoTentar={() => carregar()}
          />
        )}
        {!dados && !erro && <Esqueleto variante="painel" />}

        {dados && (
          <>
            {pedidosSenha.length > 0 && (
              <Pressable
                onPress={() => ir('Motoristas')}
                style={({ pressed }) => [styles.alertaSenha, pressed && styles.pressionado]}
                accessibilityRole="button"
                accessibilityLabel="Pedidos de nova senha"
              >
                <MaterialCommunityIcons name="lock-reset" size={22} color={VERMELHO} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertaTitulo}>
                    {pedidosSenha.length} pedido{pedidosSenha.length === 1 ? '' : 's'} de nova senha
                  </Text>
                  <Text style={styles.alertaSub}>
                    {pedidosSenha[0].nome} · CPF {pedidosSenha[0].cpf}
                    {pedidosSenha.length > 1 ? ` · +${pedidosSenha.length - 1}` : ''}
                  </Text>
                  <Text style={styles.alertaAcao}>Abrir motoristas para redefinir →</Text>
                </View>
              </Pressable>
            )}

            {tanque && (
              <Pressable
                onPress={() => ir('Tanques')}
                style={({ pressed }) => [styles.cartao, pressed && styles.pressionado]}
                accessibilityRole="button"
                accessibilityLabel="Nível do tanque principal"
              >
                <Text style={styles.rotulo}>Nível do tanque principal</Text>
                <Text style={styles.litros}>{numero(tanque.nivel_atual)} L disponíveis</Text>
                <View style={styles.barraFundo}>
                  <View
                    style={[
                      styles.barra,
                      { width: `${Math.min(tanque.percentual, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.meta}>
                  {String(tanque.percentual).replace('.', ',')}% · {tanque.tipo_combustivel}
                </Text>
              </Pressable>
            )}

            {frota && (
              <View style={styles.linha}>
                <Pressable
                  onPress={() => ir('Frota')}
                  style={({ pressed }) => [styles.meio, pressed && styles.pressionado]}
                  accessibilityRole="button"
                  accessibilityLabel="Caminhões prontos"
                >
                  <Text style={[styles.numero, { color: VERDE }]}>{frota.prontos}</Text>
                  <Text style={styles.rotuloCard}>Caminhões prontos</Text>
                </Pressable>
                <Pressable
                  onPress={() => ir('Frota')}
                  style={({ pressed }) => [styles.meio, pressed && styles.pressionado]}
                  accessibilityRole="button"
                  accessibilityLabel="Pendente atenção"
                >
                  <Text style={[styles.numero, { color: VERMELHO }]}>{frota.atencao}</Text>
                  <Text style={styles.rotuloCard}>Pendente atenção</Text>
                </Pressable>
              </View>
            )}

            {hoje && (
              <Pressable
                onPress={() => ir('Abastecimentos')}
                style={({ pressed }) => [styles.cartao, pressed && styles.pressionado]}
                accessibilityRole="button"
                accessibilityLabel="Abastecimentos hoje"
              >
                <Text style={styles.rotulo}>Abastecimentos hoje</Text>
                <View style={styles.hojeLinha}>
                  <View style={styles.hojeBloco}>
                    <Text style={styles.numero}>{hoje.quantidade}</Text>
                    <Text style={styles.rotuloCard}>registros</Text>
                  </View>
                  <View style={styles.hojeDivisor} />
                  <View style={styles.hojeBloco}>
                    <Text style={styles.numero}>{numero(hoje.litros)} L</Text>
                    <Text style={styles.rotuloCard}>total de litros</Text>
                  </View>
                </View>
              </Pressable>
            )}

            <Pressable
              onPress={() => ir('Abastecimentos')}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressionado]}
              accessibilityRole="button"
              accessibilityLabel="Abastecer caminhão"
            >
              <MaterialCommunityIcons name="plus" size={22} color="#fff" />
              <Text style={styles.ctaTexto}>Abastecer caminhão</Text>
            </Pressable>

            <Secao
              titulo="Últimos abastecimentos"
              aberta={abertos.abastecimentos}
              onToggle={() => alternar('abastecimentos')}
            />
            {abertos.abastecimentos && (
              <>
                {ultimos.length === 0 && (
                  <Pressable
                    onPress={() => ir('Abastecimentos')}
                    style={({ pressed }) => [pressed && styles.pressionado]}
                  >
                    <EstadoVazio
                      compacto
                      icone="gas-station-outline"
                      titulo="Nenhum abastecimento recente"
                      dica="Toque para registrar o primeiro."
                    />
                  </Pressable>
                )}
                {ultimos.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => ir('Abastecimentos')}
                    style={({ pressed }) => [styles.listaItem, pressed && styles.pressionado]}
                    accessibilityRole="button"
                    accessibilityLabel={`Abastecimento ${a.placa}`}
                  >
                    <View style={styles.listaTexto}>
                      <Text style={styles.listaTitulo}>
                        {a.placa} · {numero(a.litros)} L
                      </Text>
                      <Text style={styles.listaSub}>
                        {a.motorista} · {a.tanque} · {dataBR(a.data)}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#9ca3af" />
                  </Pressable>
                ))}
              </>
            )}

            <Secao
              titulo="Últimas notas fiscais"
              aberta={abertos.notas}
              onToggle={() => alternar('notas')}
            />
            {abertos.notas && (
              <>
                {notas.length === 0 && (
                  <Pressable
                    onPress={() => ir('NotasFiscais')}
                    style={({ pressed }) => [pressed && styles.pressionado]}
                  >
                    <EstadoVazio
                      compacto
                      icone="file-document-outline"
                      titulo="Nenhuma nota fiscal recente"
                      dica="Toque para cadastrar uma NF."
                    />
                  </Pressable>
                )}
                {notas.map((n) => (
                  <Pressable
                    key={n.id}
                    onPress={() => ir('NotasFiscais')}
                    style={({ pressed }) => [styles.listaItem, pressed && styles.pressionado]}
                    accessibilityRole="button"
                    accessibilityLabel={`Nota fiscal ${n.numero}`}
                  >
                    <View style={styles.listaTexto}>
                      <Text style={styles.listaTitulo}>NF {n.numero}</Text>
                      <Text style={styles.listaSub}>
                        {n.descricao} · {dataBR(n.data_emissao)}
                      </Text>
                    </View>
                    <View style={styles.listaValor}>
                      <Text style={styles.listaTitulo}>{moeda(n.valor_total)}</Text>
                      <MaterialCommunityIcons name="chevron-right" size={20} color="#9ca3af" />
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CINZA_FUNDO },
  scroll: { flex: 1 },
  conteudo: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 96 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: TEXTO_SUAVE,
    fontWeight: '600',
    marginBottom: 4},
  saudacao: { fontSize: 26, fontWeight: '700', color: TEXTO, letterSpacing: -0.4 },
  saudacaoSub: { fontSize: 14, color: TEXTO_SUAVE, marginBottom: 18, marginTop: 4 },
  alertaSenha: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CARTAO,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#fecaca',
    ...sombraSuave},
  alertaTitulo: { fontSize: 15, fontWeight: '700', color: TEXTO },
  alertaSub: { fontSize: 13, color: TEXTO_SUAVE, marginTop: 3 },
  alertaAcao: { fontSize: 13, color: VERMELHO, fontWeight: '600', marginTop: 6 },
  cartao: { backgroundColor: '#fff', borderRadius: RAIO_CARTAO, padding: 16, marginBottom: 12, ...sombraSuave},
  rotulo: { fontSize: 13, color: TEXTO_SUAVE, fontWeight: '600', marginBottom: 6 },
  litros: { fontSize: 24, fontWeight: '700', color: TEXTO, marginBottom: 12 },
  barraFundo: { height: 10, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden'},
  barra: { height: 10, borderRadius: 5, backgroundColor: VERMELHO },
  meta: { fontSize: 13, color: TEXTO_SUAVE, marginTop: 8 },
  linha: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  meio: {
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
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 8},
  ctaPressionado: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  ctaTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secaoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
    paddingVertical: 2},
  secao: { fontSize: 16, fontWeight: '700', color: TEXTO },
  listaItem: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CARTAO,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...sombraSuave},
  listaTexto: { flex: 1, minWidth: 0 },
  listaTitulo: { fontSize: 15, fontWeight: '600', color: TEXTO },
  listaSub: { fontSize: 13, color: TEXTO_SUAVE, marginTop: 3 },
  listaValor: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sino: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative'},
  sinoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3},
  sinoBadgeTexto: { fontSize: 10, fontWeight: '700', color: '#78350f' },
  pressionado: { opacity: 0.82 }});

