import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import Moldura from '../ui/Moldura';
import { mascaraMoeda, moeda, moedaParaNumero } from '../utils/formatos';
import { cores } from '../ui/tema';

const PERIODOS = [
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
  [0, 'Tudo'],
];
const ORIGENS = [
  ['todas', 'Todas'],
  ['compra', 'Notas da empresa'],
  ['posto', 'Postos'],
];

const CATEGORIAS = ['Compra de veículo', 'Peças', 'Pneus', 'Serviços', 'Outros'];

// A tela mostra a data como dd/mm/aaaa; a API recebe aaaa-mm-dd.
const hoje = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
const paraISO = (texto) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

const formVazio = () => ({
  categoria: 'Peças',
  numero: '',
  fornecedor: '',
  data: hoje(),
  valor: '',
  descricao: '',
  chave_acesso: '',
  caminhao_id: null,
});

function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
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

export default function NotasFiscais() {
  const [dias, setDias] = useState(30);
  const [origem, setOrigem] = useState('todas');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');

  const [dados, setDados] = useState(null); // resumo da última busca
  const [notas, setNotas] = useState([]);   // itens carregados (acumulam no "carregar mais")
  const [aberta, setAberta] = useState(null); // nota com os detalhes abertos

  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [confirmando, setConfirmando] = useState(null); // nota aguardando o segundo toque para excluir

  const [caminhoes, setCaminhoes] = useState([]);
  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca.trim()), 400);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregar = useCallback(
    async (pagina = 1) => {
      try {
        setErro(null);
        const params = new URLSearchParams({ dias: String(dias), origem, pagina: String(pagina) });
        if (buscaAplicada) params.set('busca', buscaAplicada);

        const r = await api(`/notas-fiscais?${params.toString()}`);
        setDados(r);
        setNotas((atual) => (pagina === 1 ? r.dados : [...atual, ...r.dados]));
      } catch (e) {
        setErro('Não foi possível carregar as notas fiscais. Verifique se o servidor está ligado.');
      } finally {
        setCarregando(false);
        setCarregandoMais(false);
        setAtualizando(false);
      }
    },
    [dias, origem, buscaAplicada]
  );

  useFocusEffect(
    useCallback(() => {
      carregar(1);
      api('/caminhoes').then(setCaminhoes).catch(() => {});
    }, [carregar])
  );

  const abrirNovo = () => {
    setForm(formVazio());
    setErroForm(null);
    setFormAberto(true);
  };

  const salvar = async () => {
    const valor = moedaParaNumero(form.valor);
    const data = paraISO(form.data);
    if (!form.numero.trim() || !form.fornecedor.trim()) return setErroForm('Informe o número e o fornecedor.');
    if (!data) return setErroForm('Informe a data no formato dd/mm/aaaa.');
    if (!(valor > 0)) return setErroForm('Informe o valor da nota.');
    if (form.chave_acesso && form.chave_acesso.length !== 44) {
      return setErroForm('A chave de acesso deve ter 44 números (ou deixe em branco).');
    }

    setSalvando(true);
    setErroForm(null);
    try {
      await api('/notas-fiscais', {
        metodo: 'POST',
        corpo: {
          categoria: form.categoria,
          numero: form.numero.trim(),
          fornecedor: form.fornecedor.trim(),
          data_emissao: data,
          valor_total: valor,
          descricao: form.descricao.trim() || null,
          chave_acesso: form.chave_acesso || null,
          caminhao_id: form.caminhao_id,
        },
      });
      setFormAberto(false);
      await carregar(1);
    } catch (e) {
      setErroForm(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (item) => {
    if (confirmando !== item.chave) {
      setConfirmando(item.chave);
      return;
    }
    try {
      await api(`/notas-fiscais/${item.id}`, { metodo: 'DELETE' });
      setConfirmando(null);
      await carregar(1);
    } catch (e) {
      setErro(mensagemDe(e));
      setConfirmando(null);
    }
  };

  const maiorFornecedor = dados?.por_fornecedor?.[0]?.valor ?? 0;

  const topo = (
    <View>
      <TextInput
        style={styles.busca}
        placeholder="Buscar por número ou fornecedor/posto"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.chips}>
        {PERIODOS.map(([valor, rotulo]) => (
          <Chip key={valor} texto={rotulo} ativo={dias === valor} aoTocar={() => setDias(valor)} />
        ))}
      </View>
      <View style={styles.chips}>
        {ORIGENS.map(([valor, rotulo]) => (
          <Chip key={valor} texto={rotulo} ativo={origem === valor} aoTocar={() => setOrigem(valor)} />
        ))}
      </View>

      {dados && (
        <>
          <View style={styles.linha}>
            <Cartao titulo="Total das notas" valor={moeda(dados.valor_total)} />
            <Cartao titulo="Notas" valor={dados.total} />
          </View>
          <View style={styles.linha}>
            <Cartao titulo="Notas da empresa" valor={moeda(dados.compras)} />
            <Cartao titulo="Postos (fora da base)" valor={moeda(dados.postos)} />
          </View>

          {dados.por_fornecedor.length > 0 && (
            <View style={styles.caixa}>
              <Text style={styles.secao}>Gasto por fornecedor</Text>
              {dados.por_fornecedor.map((f) => (
                <View key={f.fornecedor} style={{ marginTop: 8 }}>
                  <View style={styles.linhaTexto}>
                    <Text style={styles.fornecedor} numberOfLines={1}>
                      {f.fornecedor}
                    </Text>
                    <Text style={styles.valorForn}>{moeda(f.valor)}</Text>
                  </View>
                  <View style={styles.barraFundo}>
                    <View
                      style={[
                        styles.barra,
                        { width: `${maiorFornecedor > 0 ? Math.max(2, (f.valor / maiorFornecedor) * 100) : 0}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.detalhe}>
                    {f.notas} {f.notas === 1 ? 'nota' : 'notas'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.secaoLista}>Notas do período</Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="NOTAS FISCAIS">
        <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
          <Text style={styles.botaoNovoTexto}>+ Nova nota</Text>
        </Pressable>
      </Cabecalho>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      <FlatList
        data={notas}
        keyExtractor={(item) => item.chave}
        ListHeaderComponent={topo}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => {
              setAtualizando(true);
              carregar(1);
            }}
          />
        }
        ListEmptyComponent={
          !carregando && !erro ? <Text style={styles.vazio}>Nenhuma nota fiscal no período.</Text> : null
        }
        ListFooterComponent={
          dados && dados.pagina < dados.ultima_pagina ? (
            <Pressable
              style={styles.maisBotao}
              disabled={carregandoMais}
              onPress={() => {
                setCarregandoMais(true);
                carregar(dados.pagina + 1);
              }}
            >
              {carregandoMais ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.maisTexto}>
                  Carregar mais ({notas.length} de {dados.total})
                </Text>
              )}
            </Pressable>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const detalhes = aberta === item.chave;
          return (
            <Pressable style={styles.caixa} onPress={() => setAberta(detalhes ? null : item.chave)}>
              <View style={styles.linhaTexto}>
                <Text style={styles.numero}>NF {item.numero}</Text>
                <Text style={styles.valor}>{moeda(item.valor)}</Text>
              </View>
              <Text style={styles.fornecedorItem}>{item.fornecedor}</Text>
              <Text style={styles.detalhe}>
                {item.data_br} · {item.categoria}
              </Text>
              <Text style={styles.detalhe}>{item.descricao}</Text>

              {detalhes && item.chave_acesso && (
                <Text style={styles.chaveAcesso}>Chave de acesso: {item.chave_acesso}</Text>
              )}
              {detalhes && item.foto_url && (
                <Image source={{ uri: item.foto_url }} style={styles.foto} resizeMode="contain" />
              )}
              {!detalhes && (item.chave_acesso || item.foto_url) && (
                <Text style={styles.verMais}>Toque para ver {item.foto_url ? 'a foto' : 'a chave de acesso'}</Text>
              )}
              {item.pode_excluir && (
                <Pressable onPress={() => excluir(item)} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                  <Text style={[styles.excluir, confirmando === item.chave && { color: cores.perigo }]}>
                    {confirmando === item.chave ? 'Confirmar exclusão' : 'Excluir nota'}
                  </Text>
                </Pressable>
              )}
            </Pressable>
          );
        }}
      />
      <Modal visible={formAberto} animationType="slide" onRequestClose={() => setFormAberto(false)}>
        <Moldura>
        <ScrollView style={styles.tela} contentContainerStyle={styles.formConteudo} keyboardShouldPersistTaps="handled">
          <Cabecalho titulo="Nova nota fiscal" aoVoltar={() => setFormAberto(false)} />
          <Text style={styles.detalhe}>
            Notas de combustível entram pelas Entradas do tanque; as de manutenção, no lançamento da manutenção.
          </Text>

          <Text style={[styles.rotulo, { marginTop: 12 }]}>Categoria</Text>
          <View style={styles.chips}>
            {CATEGORIAS.map((c) => (
              <Chip key={c} texto={c} ativo={form.categoria === c} aoTocar={() => mudar('categoria', c)} />
            ))}
          </View>

          <Campo rotulo="Número da nota" value={form.numero} onChangeText={(v) => mudar('numero', v)} maxLength={20} />
          <Campo rotulo="Fornecedor" value={form.fornecedor} onChangeText={(v) => mudar('fornecedor', v)} />
          <Campo
            rotulo="Data de emissão (dd/mm/aaaa)"
            value={form.data}
            onChangeText={(v) => mudar('data', v)}
            maxLength={10}
          />
          <Campo
            rotulo="Valor"
            placeholder="R$ 0,00"
            value={form.valor}
            onChangeText={(v) => mudar('valor', mascaraMoeda(v))}
            keyboardType="numeric"
          />
          <Campo
            rotulo="Descrição (opcional)"
            placeholder="Ex.: Caminhão Volvo FH 540 0 km"
            value={form.descricao}
            onChangeText={(v) => mudar('descricao', v)}
          />

          <Text style={styles.rotulo}>Caminhão (opcional)</Text>
          <View style={styles.chips}>
            <Chip texto="Nenhum" ativo={form.caminhao_id === null} aoTocar={() => mudar('caminhao_id', null)} />
            {caminhoes.map((c) => (
              <Chip key={c.id} texto={c.placa} ativo={form.caminhao_id === c.id} aoTocar={() => mudar('caminhao_id', c.id)} />
            ))}
          </View>

          <Campo
            rotulo="Chave de acesso (44 números, opcional)"
            value={form.chave_acesso}
            onChangeText={(v) => mudar('chave_acesso', v.replace(/\D/g, '').slice(0, 44))}
            keyboardType="numeric"
            maxLength={44}
          />

          {erroForm && <Text style={styles.erroForm}>{erroForm}</Text>}

          <Pressable style={[styles.botao, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>Cadastrar nota</Text>}
          </Pressable>
          <Pressable style={styles.botaoSecundario} onPress={() => setFormAberto(false)} disabled={salvando}>
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>
        </ScrollView>
        </Moldura>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 16, paddingTop: 56 },
  busca: { backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
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
  linha: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  cartao: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center' },
  cartaoValor: { fontSize: 20, fontWeight: 'bold', color: cores.texto },
  cartaoTitulo: { fontSize: 12, color: cores.textoSecundario, marginTop: 4, textAlign: 'center' },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  secao: { fontSize: 16, fontWeight: '600', color: cores.texto },
  secaoLista: { fontSize: 18, fontWeight: '600', color: cores.texto, marginTop: 8, marginBottom: 8 },
  linhaTexto: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  fornecedor: { fontSize: 14, color: cores.textoMedio, flexShrink: 1 },
  valorForn: { fontSize: 14, fontWeight: '600', color: cores.texto },
  barraFundo: { height: 8, backgroundColor: cores.bordaClara, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  barra: { height: 8, backgroundColor: cores.primaria },
  erro: { color: cores.perigo, marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: cores.textoSecundario, marginTop: 30 },
  numero: { fontSize: 16, fontWeight: 'bold', color: cores.texto },
  valor: { fontSize: 16, fontWeight: 'bold', color: cores.primaria },
  fornecedorItem: { fontSize: 14, color: cores.textoMedio, fontWeight: '600', marginTop: 2 },
  detalhe: { fontSize: 13, color: cores.textoSecundario, marginTop: 3 },
  chaveAcesso: { fontSize: 12, color: cores.textoMedio, marginTop: 8 },
  verMais: { fontSize: 12, color: cores.primaria, marginTop: 6, fontWeight: '600' },
  foto: { height: 220, borderRadius: 8, marginTop: 8, backgroundColor: cores.bordaClara },
  maisBotao: { borderWidth: 1, borderColor: cores.primaria, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  maisTexto: { color: cores.primaria, fontWeight: '600', fontSize: 15 },
  excluir: { fontSize: 13, color: cores.textoSecundario, fontWeight: '600' },
  botaoNovo: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 14 },
  formConteudo: { paddingBottom: 40, width: '100%', maxWidth: 520, alignSelf: 'center' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: cores.texto, marginBottom: 6 },
  grupo: { marginBottom: 12 },
  rotulo: { fontSize: 14, color: cores.textoMedio, marginBottom: 6, fontWeight: '500' },
  campo: { backgroundColor: '#fff', borderWidth: 1, borderColor: cores.borda, borderRadius: 8, padding: 12, fontSize: 16 },
  erroForm: { color: cores.perigo, marginBottom: 12 },
  botao: { backgroundColor: cores.primaria, borderRadius: 8, padding: 14, alignItems: 'center' },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: cores.textoMedio, fontSize: 16, fontWeight: '600' },
});