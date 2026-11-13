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
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import EstadoVazio from '../ui/EstadoVazio';
import Esqueleto from '../ui/Esqueleto';
import MensagemErro from '../ui/MensagemErro';
import { useToast } from '../ui/Toast';
import { baixarArquivo } from '../utils/baixarArquivo';
import {
  cartaoBase,
  RAIO_CAMPO,
  sombraSuave,
  TEXTO,
  TEXTO_SUAVE,
  VERMELHO,
} from '../ui/tema';

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

// Uma linha "rótulo ........ valor" do cartão do motorista.
function Linha({ rotulo, valor }) {
  return (
    <View style={styles.linhaDado}>
      <Text style={styles.rotuloDado}>{rotulo}</Text>
      <Text style={styles.valorDado}>{valor}</Text>
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
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [visiveis, setVisiveis] = useState(POR_PAGINA);

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

  // Ao mudar a busca, volta para a primeira "página" visível.
  useEffect(() => {
    setVisiveis(POR_PAGINA);
  }, [buscaAplicada]);

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
          <Text style={styles.resumo}>
            Toque em um motorista para ver o histórico · {pagina.length} de {filtrados.length}
            {buscaAplicada ? ' (filtrados)' : ''}
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
  tela: { flex: 1, backgroundColor: '#f3f4f6' },
  corpo: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  conteudo: { paddingBottom: 88 },
  historicoConteudo: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  filtroRotulo: { fontSize: 12, fontWeight: '600', color: TEXTO_SUAVE, marginBottom: 6 },
  periodos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, ...sombraSuave},
  chipAtivo: { backgroundColor: VERMELHO },
  chipTexto: { fontSize: 13, fontWeight: '600', color: '#374151' },
  busca: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CAMPO,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    ...sombraSuave},
  resumo: { fontSize: 13, color: TEXTO_SUAVE, marginBottom: 10 },
  linha: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cartao: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', ...sombraSuave},
  cartaoValor: { fontSize: 22, fontWeight: '700', color: TEXTO },
  cartaoTitulo: { fontSize: 12, color: TEXTO_SUAVE, marginTop: 4, textAlign: 'center' },
  caixa: { ...cartaoBase, padding: 14, marginBottom: 10 },
  topoCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nome: { fontSize: 17, fontWeight: '700', color: TEXTO, flex: 1 },
  placas: { fontSize: 13, color: TEXTO_SUAVE, marginTop: 2, marginBottom: 8 },
  linhaDado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6'},
  rotuloDado: { fontSize: 14, color: TEXTO_SUAVE },
  valorDado: { fontSize: 14, fontWeight: '600', color: TEXTO },
  nota: { fontSize: 12, color: TEXTO_SUAVE, marginTop: 8 },
  maisBotao: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CAMPO,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
    ...sombraSuave},
  maisTexto: { color: VERMELHO, fontWeight: '600', fontSize: 15 },
  botaoBaixar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    minWidth: 64,
    justifyContent: 'center'},
  botaoBaixarTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  acao: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    ...sombraSuave},
  acaoTitulo: { fontSize: 15, fontWeight: '700', color: TEXTO },
  acaoSub: { fontSize: 13, color: TEXTO_SUAVE, marginTop: 2 },
  acaoMeta: { fontSize: 12, color: TEXTO_SUAVE, marginTop: 4 }});
