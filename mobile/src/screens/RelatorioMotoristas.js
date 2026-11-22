import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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

const POR_PAGINA = 15;

const PERIODOS = [
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
  [0, 'Tudo'],
];

const ICONE_TIPO = {
  abastecimento: 'gas-station-outline',
  lavagem: 'car-wash',
  manutencao: 'wrench-outline'};

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

function Chip({ texto, ativo, aoTocar }) {
  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [styles.chip, ativo && styles.chipAtivo, pressed && { opacity: 0.85 }]}
    >
      <Text style={[styles.chipTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

// RELATORIO MOTORISTAS — ranking + histórico/CSV por motorista.
export default function RelatorioMotoristas() {
  const toast = useToast();
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
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

  const [selecionado, setSelecionado] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [erroHistorico, setErroHistorico] = useState(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [diasHistorico, setDiasHistorico] = useState(30);
  const [buscaHistorico, setBuscaHistorico] = useState('');
  const [buscaHistoricoAplicada, setBuscaHistoricoAplicada] = useState('');
  const [visiveisHistorico, setVisiveisHistorico] = useState(POR_PAGINA);

  // Só pesquisa 0,4 s depois que a pessoa para de digitar.
  useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca.trim().toLowerCase()), 400);
    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    const timer = setTimeout(
      () => setBuscaHistoricoAplicada(buscaHistorico.trim().toLowerCase()),
      400
    );
    return () => clearTimeout(timer);
  }, [buscaHistorico]);

  // RELATORIO CARREGAR
  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setDados(await api(`/relatorios/motoristas?dias=${dias}`));
      setVisiveis(POR_PAGINA);
    } catch (e) {
      const msg = 'Não foi possível carregar o relatório. Verifique se o servidor está ligado.';
      setErro(msg);
      toast.erro(msg);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [dias]); // toast estável via ToastProvider

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

  useEffect(() => {
    setVisiveisHistorico(POR_PAGINA);
  }, [buscaHistoricoAplicada, historico]);

  // RELATORIO HISTORICO_MOTORISTA
  const carregarHistorico = useCallback(async (motorista, periodo) => {
    if (!motorista) return;
    setHistorico(null);
    setErroHistorico(null);
    setCarregandoHistorico(true);
    setVisiveisHistorico(POR_PAGINA);
    try {
      setHistorico(
        await api(`/relatorios/motoristas/${motorista.motorista_id}?dias=${periodo}`)
      );
    } catch (e) {
      setErroHistorico(e.message || 'Não foi possível carregar o histórico.');
    } finally {
      setCarregandoHistorico(false);
    }
  }, []);

  const abrirHistorico = (motorista) => {
    setSelecionado(motorista);
    setDiasHistorico(dias);
    setBuscaHistorico('');
    setBuscaHistoricoAplicada('');
    carregarHistorico(motorista, dias);
  };

  const fecharHistorico = () => {
    setSelecionado(null);
    setHistorico(null);
    setErroHistorico(null);
    setBuscaHistorico('');
    setBuscaHistoricoAplicada('');
    setVisiveisHistorico(POR_PAGINA);
  };

  const baixarMotorista = async () => {
    if (!selecionado) return;
    setBaixando(true);
    try {
      const slug = String(selecionado.nome || 'motorista')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      await baixarArquivo(
        `/relatorios/motoristas/${selecionado.motorista_id}/exportar?dias=${diasHistorico}`,
        `relatorio-motorista-${slug || selecionado.motorista_id}.csv`
      );
      toast.sucesso('Arquivo do motorista baixado.');
    } catch (e) {
      toast.erro(e.message || 'Não foi possível baixar o arquivo.');
    } finally {
      setBaixando(false);
    }
  };

  const filtrados = useMemo(() => {
    const lista = dados?.motoristas ?? [];
    if (!buscaAplicada) return lista;
    return lista.filter((m) => m.nome.toLowerCase().includes(buscaAplicada));
  }, [dados, buscaAplicada]);

  const pagina = filtrados.slice(0, visiveis);
  const temMais = visiveis < filtrados.length;

  const acoesHistorico = useMemo(() => {
    const lista = historico?.acoes ?? [];
    if (!buscaHistoricoAplicada) return lista;
    return lista.filter((a) => {
      const texto = [a.tipo_rotulo, a.placa, a.detalhe, a.data_br, a.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return texto.includes(buscaHistoricoAplicada);
    });
  }, [historico, buscaHistoricoAplicada]);

  const paginaHistorico = acoesHistorico.slice(0, visiveisHistorico);
  const temMaisHistorico = visiveisHistorico < acoesHistorico.length;

  const temResumo = dados && Number(dados.resumo?.motoristas) > 0;

  const cabecalho = (
    <View>
      <Text style={styles.filtroRotulo}>Período</Text>
      <View style={styles.periodos}>
        {PERIODOS.map(([valor, rotulo]) => (
          <Chip key={valor} texto={rotulo} ativo={dias === valor} aoTocar={() => setDias(valor)} />
        ))}
      </View>

      <TextInput
        style={styles.busca}
        placeholder="Buscar motorista"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {dados && temResumo && (
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
    </View>
  );

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="Relatório motoristas" />

      <View style={styles.corpo}>
        {erro && (
          <MensagemErro
            titulo="Erro ao carregar relatório"
            mensagem={erro}
            aoTentar={() => {
              setCarregando(true);
              carregar();
            }}
          />
        )}

        {carregando && !erro && (
          <>
            <Text style={styles.filtroRotulo}>Período</Text>
            <View style={styles.periodos}>
              {PERIODOS.map(([valor, rotulo]) => (
                <Chip key={valor} texto={rotulo} ativo={dias === valor} aoTocar={() => setDias(valor)} />
              ))}
            </View>
            <Esqueleto linhas={3} />
          </>
        )}

        {!carregando && !erro && (
          <FlatList
            data={pagina}
            keyExtractor={(item) => String(item.motorista_id)}
            ListHeaderComponent={cabecalho}
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
            ListEmptyComponent={
              <EstadoVazio
                icone="account-search-outline"
                titulo={buscaAplicada ? 'Nenhum motorista neste filtro' : 'Nenhum motorista no período'}
                dica={
                  buscaAplicada
                    ? 'Limpe a busca ou troque o período.'
                    : 'Quando houver abastecimentos, o resumo aparece aqui.'
                }
              />
            }
            ListFooterComponent={
              temMais ? (
                <Pressable
                  style={({ pressed }) => [styles.maisBotao, pressed && { opacity: 0.85 }]}
                  onPress={() => setVisiveis((n) => n + POR_PAGINA)}
                >
                  <Text style={styles.maisTexto}>
                    Carregar mais ({pagina.length} de {filtrados.length})
                  </Text>
                </Pressable>
              ) : dados && pagina.length > 0 ? (
                <Text style={styles.nota}>
                  Consumo = km rodados ÷ litros, considerando só caminhões com 2 ou mais abastecimentos no
                  período.
                </Text>
              ) : null
            }
            contentContainerStyle={styles.conteudo}
            renderItem={({ item: m }) => (
              <Pressable
                onPress={() => abrirHistorico(m)}
                style={({ pressed }) => [styles.caixa, pressed && { opacity: 0.88 }]}
                accessibilityRole="button"
                accessibilityLabel={`Histórico de ${m.nome}`}
              >
                <View style={styles.topoCard}>
                  <Text style={styles.nome}>{m.nome}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={22} color="#9ca3af" />
                </View>
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
              </Pressable>
            )}
          />
        )}
      </View>

      <Modal visible={!!selecionado} animationType="slide" onRequestClose={fecharHistorico}>
        <View style={styles.tela}>
          <Cabecalho titulo={selecionado?.nome || 'Histórico'} aoVoltar={fecharHistorico}>
            <Pressable
              onPress={baixarMotorista}
              disabled={baixando || carregandoHistorico}
              style={styles.botaoBaixar}
              accessibilityRole="button"
              accessibilityLabel="Baixar histórico do motorista"
            >
              {baixando ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="download" size={18} color="#fff" />
                  <Text style={styles.botaoBaixarTexto}>CSV</Text>
                </>
              )}
            </Pressable>
          </Cabecalho>

          <ScrollView
            contentContainerStyle={styles.historicoConteudo}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.filtroRotulo}>Período</Text>
            <View style={styles.periodos}>
              {PERIODOS.map(([valor, rotulo]) => (
                <Chip
                  key={valor}
                  texto={rotulo}
                  ativo={diasHistorico === valor}
                  aoTocar={() => {
                    setDiasHistorico(valor);
                    if (selecionado) carregarHistorico(selecionado, valor);
                  }}
                />
              ))}
            </View>

            <TextInput
              style={styles.busca}
              placeholder="Buscar no histórico"
              value={buscaHistorico}
              onChangeText={setBuscaHistorico}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Buscar no histórico do motorista"
            />

            {carregandoHistorico && (
              <ActivityIndicator size="large" style={{ marginTop: 40 }} color={VERMELHO} />
            )}
            {erroHistorico && (
              <MensagemErro
                titulo="Erro ao carregar histórico"
                mensagem={erroHistorico}
                aoTentar={() => selecionado && carregarHistorico(selecionado, diasHistorico)}
              />
            )}

            {historico && !carregandoHistorico && (
              <>
                <View style={styles.linha}>
                  <Cartao titulo="Ações" valor={historico.resumo.acoes} />
                  <Cartao titulo="Litros" valor={numero(historico.resumo.total_litros)} />
                  <Cartao titulo="Gastos" valor={moeda(historico.resumo.gasto_total)} />
                </View>
                <Text style={styles.resumo}>
                  {historico.resumo.abastecimentos} abastecimentos · {historico.resumo.lavagens} lavagens ·{' '}
                  {historico.resumo.manutencoes} manutenções
                  {' · '}
                  {paginaHistorico.length} de {acoesHistorico.length}
                  {buscaHistoricoAplicada ? ' (filtrados)' : ''}
                </Text>

                {acoesHistorico.length === 0 ? (
                  <EstadoVazio
                    icone="clipboard-text-outline"
                    titulo={
                      buscaHistoricoAplicada
                        ? 'Nenhuma ação neste filtro'
                        : 'Nenhuma ação no período'
                    }
                    dica={
                      buscaHistoricoAplicada
                        ? 'Limpe a busca ou troque o período.'
                        : 'Troque o período acima ou aguarde novos lançamentos.'
                    }
                  />
                ) : (
                  <>
                    {paginaHistorico.map((a) => (
                      <View key={a.id} style={styles.acao}>
                        <MaterialCommunityIcons
                          name={ICONE_TIPO[a.tipo] || 'circle-outline'}
                          size={22}
                          color={VERMELHO}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.acaoTitulo}>
                            {a.tipo_rotulo}
                            {a.placa ? ` · ${a.placa}` : ''}
                          </Text>
                          <Text style={styles.acaoSub}>{a.detalhe}</Text>
                          <Text style={styles.acaoMeta}>
                            {a.data_br}
                            {a.litros != null ? ` · ${litrosFmt(a.litros)} L` : ''}
                            {a.km != null ? ` · ${numero(a.km)} km` : ''}
                            {a.valor > 0 ? ` · ${moeda(a.valor)}` : ''}
                            {a.status && a.status !== 'aprovado' ? ` · ${a.status}` : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {temMaisHistorico ? (
                      <Pressable
                        style={({ pressed }) => [styles.maisBotao, pressed && { opacity: 0.85 }]}
                        onPress={() => setVisiveisHistorico((n) => n + POR_PAGINA)}
                        accessibilityRole="button"
                        accessibilityLabel="Carregar mais ações do histórico"
                      >
                        <Text style={styles.maisTexto}>
                          Carregar mais ({paginaHistorico.length} de {acoesHistorico.length})
                        </Text>
                      </Pressable>
                    ) : null}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
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