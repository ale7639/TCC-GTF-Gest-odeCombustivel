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

// RELATORIO — combustível: KPIs, gráfico, ranking por caminhão + histórico/CSV.

// RELATORIO FMT — funções de formatação.
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const numero = (n) => separar(String(Math.round(n)));
const litrosFmt = (n) => {
  const [inteiro, decimal] = String(Number(n)).split('.');
  return separar(inteiro) + (decimal ? `,${decimal}` : '');
};
const consumoFmt = (n) => String(n).replace('.', ',');
const moeda = (n) => 'R$ ' + separar(Number(n).toFixed(2).replace('.', ','));
const diaCurto = (iso) => {
  const p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? p[2] : iso;
};

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

function CartaoKpi({ titulo, valor, corValor }) {
  return (
    <View style={styles.cartao}>
      <Text style={styles.cartaoTitulo}>{titulo}</Text>
      <Text
        style={[styles.cartaoValor, corValor ? { color: corValor } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {valor}
      </Text>
    </View>
  );
}

function CartaoMini({ titulo, valor }) {
  return (
    <View style={styles.cartaoMini}>
      <Text style={styles.cartaoMiniValor} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      <Text style={styles.cartaoMiniTitulo}>{titulo}</Text>
    </View>
  );
}

// Gráfico de barras vertical simples (Consumo por dia) — dados de por_dia.
function GraficoBarras({ serie }) {
  if (!serie?.length) return null;
  const maximo = Math.max(1, ...serie.map((d) => d.litros));
  const amostra =
    serie.length > 14
      ? serie.filter((_, i) => i % Math.ceil(serie.length / 14) === 0 || i === serie.length - 1)
      : serie;

  return (
    <View style={styles.graficoCard}>
      <Text style={styles.graficoTitulo}>Consumo por dia (L)</Text>
      <View style={styles.graficoArea}>
        {amostra.map((d) => {
          const alt = Math.max(4, (d.litros / maximo) * 120);
          return (
            <View key={d.dia} style={styles.graficoColuna}>
              <Text style={styles.graficoValor}>{Math.round(d.litros)}</Text>
              <View style={[styles.graficoBarra, { height: alt }]} />
              <Text style={styles.graficoLabel}>{diaCurto(d.dia)}</Text>
            </View>
          );
        })}
      </View>
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

// RELATORIO ABASTECIMENTOS
export default function RelatorioAbastecimentos() {
  const toast = useToast();
  const navegacao = useNavigation();
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [busca, setBusca] = useState(''); // filtra a lista "Por caminhão" (placa, modelo ou motorista)
  const [tanqueId, setTanqueId] = useState(null); // null = todos os tanques
  const navegacao = useNavigation();

  // Toque no cartão do caminhão: abre a lista de abastecimentos dele, no mesmo período e tanque.
  // "chave" muda a cada toque, para a outra tela aplicar o filtro mesmo se for a mesma placa.
  const verAbastecimentos = (placa) =>
    navegacao.navigate('Abastecimentos', { filtro: { busca: placa, dias, tanqueId, chave: Date.now() } });

  const [selecionado, setSelecionado] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [erroHistorico, setErroHistorico] = useState(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [baixandoHistorico, setBaixandoHistorico] = useState(false);
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
      setDados(await api(`/relatorios/abastecimentos?dias=${dias}${tanqueId ? `&tanque_id=${tanqueId}` : ''}`));
    } catch (e) {
      const msg = 'Não foi possível carregar o relatório. Verifique se o servidor está ligado.';
      setErro(msg);
      toast.erro(msg);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [dias, tanqueId]);

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

  useEffect(() => {
    setVisiveisHistorico(POR_PAGINA);
  }, [buscaHistoricoAplicada, historico]);

  // RELATORIO HISTORICO_CAMINHAO
  const carregarHistorico = useCallback(
    async (caminhao, periodo) => {
      if (!caminhao) return;
      setHistorico(null);
      setErroHistorico(null);
      setCarregandoHistorico(true);
      setVisiveisHistorico(POR_PAGINA);
      try {
        setHistorico(
          await api(`/relatorios/caminhoes/${caminhao.caminhao_id}?dias=${periodo}`)
        );
      } catch (e) {
        setErroHistorico(e.message || 'Não foi possível carregar o histórico.');
      } finally {
        setCarregandoHistorico(false);
      }
    },
    []
  );

  const abrirHistorico = (caminhao) => {
    setSelecionado(caminhao);
    setDiasHistorico(dias);
    setBuscaHistorico('');
    setBuscaHistoricoAplicada('');
    carregarHistorico(caminhao, dias);
  };

  const fecharHistorico = () => {
    setSelecionado(null);
    setHistorico(null);
    setErroHistorico(null);
    setBuscaHistorico('');
    setBuscaHistoricoAplicada('');
    setVisiveisHistorico(POR_PAGINA);
  };

  const baixar = async () => {
    setBaixando(true);
    try {
      await baixarArquivo(
        `/relatorios/abastecimentos/exportar?dias=${dias}`,
        'relatorio-abastecimentos.csv'
      );
      toast.sucesso('Arquivo de combustível baixado.');
    } catch (e) {
      toast.erro(e.message || 'Não foi possível baixar o relatório.');
    } finally {
      setBaixando(false);
    }
  };

  const baixarCaminhao = async () => {
    if (!selecionado) return;
    setBaixandoHistorico(true);
    try {
      const slug = String(selecionado.placa || 'caminhao')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      await baixarArquivo(
        `/relatorios/caminhoes/${selecionado.caminhao_id}/exportar?dias=${diasHistorico}`,
        `relatorio-caminhao-${slug || selecionado.caminhao_id}.csv`
      );
      toast.sucesso('Arquivo do caminhão baixado.');
    } catch (e) {
      toast.erro(e.message || 'Não foi possível baixar o arquivo.');
    } finally {
      setBaixandoHistorico(false);
    }
  };

  const porCaminhao = dados?.por_caminhao ?? [];
  const filtrados = useMemo(() => {
    if (!buscaAplicada) return porCaminhao;
    return porCaminhao.filter((c) => {
      const placa = String(c.placa || '').toLowerCase();
      const modelo = String(c.modelo || '').toLowerCase();
      return placa.includes(buscaAplicada) || modelo.includes(buscaAplicada);
    });
  }, [porCaminhao, buscaAplicada]);

  const porDia = dados?.por_dia ?? [];
  const pagina = filtrados.slice(0, visiveis);
  const temMais = visiveis < filtrados.length;

  const acoesHistorico = useMemo(() => {
    const lista = historico?.acoes ?? [];
    if (!buscaHistoricoAplicada) return lista;
    return lista.filter((a) => {
      const texto = [a.tipo_rotulo, a.motorista, a.detalhe, a.data_br, a.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return texto.includes(buscaHistoricoAplicada);
    });
  }, [historico, buscaHistoricoAplicada]);

  const paginaHistorico = acoesHistorico.slice(0, visiveisHistorico);
  const temMaisHistorico = visiveisHistorico < acoesHistorico.length;

  const temResumo = dados && Number(dados.resumo?.abastecimentos) > 0;
  const mediaDiaria = dados?.resumo?.media_diaria;

  const cabecalho = (
    <View>
      <Text style={styles.filtroRotulo}>Outros relatórios</Text>
      <View style={styles.atalhos}>
        <Pressable
          onPress={() => navegacao.navigate('NotasFiscais')}
          style={({ pressed }) => [styles.atalho, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Abrir notas fiscais"
        >
          <MaterialCommunityIcons name="file-document-outline" size={20} color={VERMELHO} />
          <View style={{ flex: 1 }}>
            <Text style={styles.atalhoTitulo}>Notas</Text>
            <Text style={styles.atalhoSub}>Notas fiscais e gastos</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#9ca3af" />
        </Pressable>
        <Pressable
          onPress={() => navegacao.navigate('RelatorioMotoristas')}
          style={({ pressed }) => [styles.atalho, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Abrir relatório de motoristas"
        >
          <MaterialCommunityIcons name="account-details-outline" size={20} color={VERMELHO} />
          <View style={{ flex: 1 }}>
            <Text style={styles.atalhoTitulo}>Motoristas</Text>
            <Text style={styles.atalhoSub}>Histórico por motorista</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#9ca3af" />
        </Pressable>
      </View>

      <Text style={styles.filtroRotulo}>Combustível · período</Text>
      <View style={styles.periodos}>
        {PERIODOS.map(([valor, rotulo]) => (
          <Chip key={valor} texto={rotulo} ativo={dias === valor} aoTocar={() => setDias(valor)} />
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

      {dados && temResumo && (
        <>
          <View style={styles.linha}>
            <CartaoKpi
              titulo="Total de litros"
              valor={`${numero(dados.resumo.total_litros)} L`}
              corValor={VERDE}
            />
            <CartaoKpi
              titulo="Média diária"
              valor={mediaDiaria != null ? `${litrosFmt(mediaDiaria)} L` : '—'}
              corValor={VERMELHO}
            />
          </View>
          <View style={styles.linha}>
            <CartaoKpi titulo="Abastecimentos" valor={String(dados.resumo.abastecimentos)} />
            <CartaoKpi
              titulo="Consumo médio"
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
    </View>
  );

  const rodape = (
    <View>
      {temMais ? (
        <Pressable
          style={({ pressed }) => [styles.maisBotao, pressed && { opacity: 0.85 }]}
          onPress={() => setVisiveis((n) => n + POR_PAGINA)}
        >
          <Text style={styles.maisTexto}>
            Carregar mais ({pagina.length} de {filtrados.length})
          </Text>
        </Pressable>
      ) : null}

      {dados && temResumo && dados.por_tanque?.length > 0 && (
        <>
          <Text style={styles.secao}>Por tanque</Text>
          {dados.por_tanque.map((t) => {
            const maxTanque = Math.max(0, ...dados.por_tanque.map((x) => x.litros));
            const largura = maxTanque > 0 ? Math.max(2, (t.litros / maxTanque) * 100) : 0;
            return (
              <View key={t.tanque_id} style={styles.caixa}>
                <View style={styles.topo}>
                  <Text style={styles.nomeItem}>{t.nome}</Text>
                  <Text style={styles.destaque}>{litrosFmt(t.litros)} L</Text>
                </View>
                <View style={styles.barraFundo}>
                  <View style={[styles.barra, { width: `${largura}%` }]} />
                </View>
                <Text style={styles.detalhe}>
                  {t.abastecimentos} {t.abastecimentos === 1 ? 'abastecimento' : 'abastecimentos'}
                </Text>
              </View>
            );
          })}
        </>
      )}

      {dados && temResumo && (
        <Text style={styles.rodape}>
          O consumo é estimado: km rodados entre o primeiro e o último abastecimento do período,
          divididos pelos litros colocados depois do primeiro. Considera que cada abastecimento
          completa o tanque.
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="Relatórios">
        <Pressable
          onPress={baixar}
          disabled={baixando}
          style={styles.botaoBaixar}
          accessibilityRole="button"
          accessibilityLabel="Baixar relatório de combustível"
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
            <Esqueleto variante="painel" />
          </>
        )}

        {!carregando && !erro && (
          <FlatList
            data={temResumo ? pagina : []}
            keyExtractor={(item) => String(item.caminhao_id)}
            ListHeaderComponent={cabecalho}
            ListFooterComponent={temResumo ? rodape : null}
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
                icone="chart-box-outline"
                titulo={
                  buscaAplicada
                    ? 'Nenhum caminhão neste filtro'
                    : 'Nenhum abastecimento no período'
                }
                dica={
                  buscaAplicada
                    ? 'Limpe a busca ou troque o período.'
                    : 'Troque o período acima ou registre um abastecimento na tela Abastecer.'
                }
              />
            }
            contentContainerStyle={styles.conteudo}
            renderItem={({ item: c, index }) => (
              <Pressable
                onPress={() => abrirHistorico(c)}
                style={({ pressed }) => [styles.caixa, pressed && { opacity: 0.88 }]}
                accessibilityRole="button"
                accessibilityLabel={`Histórico do caminhão ${c.placa}`}
              >
                <View style={styles.topo}>
                  <Text style={styles.rank}>{index + 1}.</Text>
                  <Text style={styles.nomeItem}>
                    {c.placa} · {c.modelo}
                  </Text>
                  <Text style={styles.destaque}>{litrosFmt(c.litros)} L</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#9ca3af" />
                </View>
                <Text style={styles.detalhe}>
                  {c.abastecimentos}{' '}
                  {c.abastecimentos === 1 ? 'abastecimento' : 'abastecimentos'}
                  {c.consumo_km_l != null
                    ? ` · ${consumoFmt(c.consumo_km_l)} km/L`
                    : ' · consumo n/d'}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>

      <Modal visible={!!selecionado} animationType="slide" onRequestClose={fecharHistorico}>
        <View style={styles.tela}>
          <Cabecalho
            titulo={
              selecionado
                ? `${selecionado.placa}${selecionado.modelo ? ` · ${selecionado.modelo}` : ''}`
                : 'Histórico'
            }
            aoVoltar={fecharHistorico}
          >
            <Pressable
              onPress={baixarCaminhao}
              disabled={baixandoHistorico || carregandoHistorico}
              style={styles.botaoBaixar}
              accessibilityRole="button"
              accessibilityLabel="Baixar histórico do caminhão"
            >
              {baixandoHistorico ? (
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
              accessibilityLabel="Buscar no histórico do caminhão"
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
                  <CartaoMini titulo="Ações" valor={historico.resumo.acoes} />
                  <CartaoMini titulo="Litros" valor={numero(historico.resumo.total_litros)} />
                  <CartaoMini titulo="Gastos" valor={moeda(historico.resumo.gasto_total)} />
                </View>
                <Text style={styles.resumo}>
                  {historico.resumo.abastecimentos} abastecimentos · {historico.resumo.lavagens}{' '}
                  lavagens · {historico.resumo.manutencoes} manutenções
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
                            {a.motorista ? ` · ${a.motorista}` : ''}
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
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...sombraSuave},
  atalhoTitulo: { fontSize: 15, fontWeight: '700', color: TEXTO },
  atalhoSub: { fontSize: 12, color: TEXTO_SUAVE, marginTop: 2 },
  periodos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  busca: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CAMPO,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    ...sombraSuave},
  chip: { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, ...sombraSuave},
  chipAtivo: { backgroundColor: VERMELHO },
  chipTexto: { fontSize: 13, fontWeight: '600', color: '#374151' },
  botaoBaixar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  periodoAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  periodoTexto: { fontSize: 14, fontWeight: '600', color: cores.textoMedio },
  erro: { color: cores.perigo, marginTop: 20, textAlign: 'center' },
  vazio: { color: cores.textoSecundario, marginBottom: 8 },
  linha: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  cartao: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, ...sombraSuave},
  cartaoTitulo: { fontSize: 12, color: TEXTO_SUAVE, marginBottom: 4 },
  cartaoValor: { fontSize: 22, fontWeight: '800', color: TEXTO },
  cartaoMini: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    ...sombraSuave},
  cartaoMiniValor: { fontSize: 20, fontWeight: '700', color: TEXTO },
  cartaoMiniTitulo: { fontSize: 12, color: TEXTO_SUAVE, marginTop: 4, textAlign: 'center' },
  graficoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
    ...sombraSuave},
  graficoTitulo: { fontSize: 15, fontWeight: '700', color: TEXTO, marginBottom: 12 },
  graficoArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 160,
    gap: 2},
  graficoColuna: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  graficoValor: { fontSize: 9, color: TEXTO_SUAVE, marginBottom: 4 },
  graficoBarra: {
    width: '70%',
    maxWidth: 18,
    backgroundColor: VERMELHO,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4},
  graficoLabel: { fontSize: 9, color: TEXTO_SUAVE, marginTop: 4 },
  secao: { fontSize: 17, fontWeight: '700', marginTop: 16, marginBottom: 8, color: TEXTO },
  caixa: { ...cartaoBase },
  topo: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  rank: { fontSize: 15, fontWeight: '800', color: VERMELHO, width: 22 },
  nomeItem: { fontSize: 15, fontWeight: '600', color: TEXTO, flex: 1, flexShrink: 1 },
  destaque: { fontSize: 15, fontWeight: '800', color: TEXTO },
  barraFundo: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  barra: { height: 8, backgroundColor: VERMELHO },
  detalhe: { fontSize: 13, color: TEXTO_SUAVE, marginTop: 4 },
  rodape: { fontSize: 12, color: TEXTO_SUAVE, marginTop: 16, lineHeight: 18 },
  maisBotao: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CAMPO,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
    ...sombraSuave},
  maisTexto: { color: VERMELHO, fontWeight: '600', fontSize: 15 },
  acao: {
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