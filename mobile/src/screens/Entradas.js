import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import SeletorLista from '../components/SeletorLista';
import { mascaraMoeda, moedaParaNumero } from '../utils/formatos';

// Funções de formatação.
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const litrosFmt = (n) => {                                            // "273.50" -> "273,5"
  const [inteiro, decimal] = String(Number(n)).split('.');
  return separar(inteiro) + (decimal ? `,${decimal}` : '');
};
const moeda = (n) => 'R$ ' + separar(Number(n).toFixed(2).replace('.', ','));
const moedaL = (n) => 'R$ ' + Number(n).toFixed(2).replace('.', ',') + '/L';
const dataBR = (d) => d.slice(0, 10).split('-').reverse().join('/');  // "2026-10-16..." -> "16/10/2026"

// A tela mostra a data como dd/mm/aaaa; a API recebe aaaa-mm-dd.
const hoje = () => {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
};
const paraISO = (texto) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

// Mensagem amigável para qualquer erro de comunicação com a API.
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

const PERIODOS = [
  [0, 'Tudo'],
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
];

// Formulário em branco para uma entrada nova.
const formVazio = () => ({
  tanque_id: null,
  data: hoje(),
  litros: '',
  valor_total: '',
  nf_numero: '',
  nf_fornecedor: '',
});

// Campo de texto com rótulo em cima.
function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
    </View>
  );
}

// Botão de escolha (usado para o tanque).
function Opcao({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.opcao, ativo && styles.opcaoAtiva]}>
      <Text style={[styles.opcaoTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

function Chip({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.chip, ativo && styles.chipAtivo]}>
      <Text style={[styles.chipTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

// Esta tela aparece dentro da aba "Tanques", no botão "Entradas".
export default function Entradas() {
  const [entradas, setEntradas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [tanques, setTanques] = useState([]);
  const [dias, setDias] = useState(30);
  const [tanqueFiltro, setTanqueFiltro] = useState(null);

  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);

  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState(formVazio());
  const [foto, setFoto] = useState(null);
  const [fotoAberta, setFotoAberta] = useState(null); // URL da foto aberta na lista
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null); // item que aguarda o segundo toque para excluir

  const carregarLista = useCallback(
    async (numeroPagina = 1) => {
      try {
        setErro(null);
        const params = new URLSearchParams({
          pagina: String(numeroPagina),
          dias: String(dias),
        });
        if (tanqueFiltro) params.set('tanque_id', String(tanqueFiltro));

        const resposta = await api(`/entradas?${params.toString()}`);
        setEntradas((atual) =>
          numeroPagina === 1 ? resposta.dados : [...atual, ...resposta.dados]
        );
        setPagina(resposta.pagina);
        setUltimaPagina(resposta.ultima_pagina);
        setTotal(resposta.total);
      } catch (e) {
        setErro('Não foi possível carregar as entradas. Verifique se o servidor está ligado.');
      } finally {
        setCarregando(false);
        setCarregandoMais(false);
        setAtualizando(false);
      }
    },
    [dias, tanqueFiltro]
  );

  const carregarApoio = useCallback(async () => {
    try {
      setTanques(await api('/tanques'));
    } catch (e) {
      // A lista principal já mostra o aviso de conexão.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarApoio();
      carregarLista(1);
    }, [carregarApoio, carregarLista])
  );

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const escolherFoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!r.canceled) setFoto(r.assets[0]);
  };

  const abrirNovo = () => {
    setForm(formVazio());
    setFoto(null);
    setErroForm(null);
    setFormAberto(true);
  };

  const fechar = () => {
    setFormAberto(false);
    setFoto(null);
    setErroForm(null);
  };

  // Pré-visualização: como o custo médio do tanque escolhido muda com esta compra.
  const tanqueEscolhido = tanques.find((t) => t.id === form.tanque_id);
  const litrosPrev = Number(String(form.litros).replace(',', '.'));
  const valorPrev = moedaParaNumero(form.valor_total);
  let previa = null;
  if (tanqueEscolhido && litrosPrev > 0 && valorPrev >= 0) {
    const nivel = Number(tanqueEscolhido.nivel_atual);
    const estoque = Number(tanqueEscolhido.valor_estoque ?? 0);
    previa = {
      antes: nivel > 0 ? estoque / nivel : null,
      compra: valorPrev / litrosPrev,
      depois: (estoque + valorPrev) / (nivel + litrosPrev),
    };
  }

  const salvar = async () => {
    const litros = Number(String(form.litros).replace(',', '.'));
    const valor = moedaParaNumero(form.valor_total);
    const data = paraISO(form.data);
    const nfNumero = form.nf_numero.trim();
    const nfFornecedor = form.nf_fornecedor.trim();

    if (!form.tanque_id) {
      setErroForm('Escolha o tanque.');
      return;
    }
    if (!(litros > 0)) {
      setErroForm('Informe a quantidade de litros.');
      return;
    }
    if (form.valor_total === '' || Number.isNaN(valor) || valor < 0) {
      setErroForm('Informe o valor total da compra.');
      return;
    }
    if (!data) {
      setErroForm('Informe a data no formato dd/mm/aaaa.');
      return;
    }
    if (foto && !nfNumero) {
      setErroForm('Informe o número da nota para anexar a foto.');
      return;
    }
    if (nfNumero && !nfFornecedor) {
      setErroForm('Informe o fornecedor da nota fiscal.');
      return;
    }

    setSalvando(true);
    setErroForm(null);
    try {
      if (foto) {
        // FormData permite enviar a foto junto com os campos.
        const corpo = new FormData();
        corpo.append('tanque_id', String(form.tanque_id));
        corpo.append('data', data);
        corpo.append('litros', String(litros));
        corpo.append('valor_total', String(valor));
        corpo.append('nf_numero', nfNumero);
        corpo.append('nf_fornecedor', nfFornecedor);
        const nome = foto.fileName ?? 'foto.jpg';
        if (Platform.OS === 'web') {
          corpo.append('foto', await (await fetch(foto.uri)).blob(), nome);
        } else {
          corpo.append('foto', { uri: foto.uri, name: nome, type: foto.mimeType ?? 'image/jpeg' });
        }
        await api('/entradas', { metodo: 'POST', corpo });
      } else {
        await api('/entradas', {
          metodo: 'POST',
          corpo: {
            tanque_id: form.tanque_id,
            data,
            litros,
            valor_total: valor,
            nf_numero: nfNumero || null,
            nf_fornecedor: nfFornecedor || null,
          },
        });
      }
      fechar();
      carregarApoio();
      await carregarLista(1);
    } catch (e) {
      setErroForm(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id) => {
    // Primeiro toque: pede confirmação. Segundo toque: exclui.
    if (confirmandoId !== id) {
      setConfirmandoId(id);
      return;
    }

    try {
      await api(`/entradas/${id}`, { metodo: 'DELETE' });
      setConfirmandoId(null);
      carregarApoio();
      await carregarLista(1);
    } catch (e) {
      setErro(mensagemDe(e));
      setConfirmandoId(null);
    }
  };

  const filtros = (
    <View style={styles.filtros}>
      <View style={styles.chips}>
        {PERIODOS.map(([valor, rotulo]) => (
          <Chip key={valor} texto={rotulo} ativo={dias === valor} aoTocar={() => setDias(valor)} />
        ))}
      </View>
      <View style={styles.chips}>
        <Chip texto="Todos os tanques" ativo={tanqueFiltro === null} aoTocar={() => setTanqueFiltro(null)} />
        {tanques.map((t) => (
          <Chip
            key={t.id}
            texto={t.nome}
            ativo={tanqueFiltro === t.id}
            aoTocar={() => setTanqueFiltro(t.id)}
          />
        ))}
      </View>
      <Text style={styles.resumo}>
        {total} {total === 1 ? 'entrada' : 'entradas'}
      </Text>
    </View>
  );

  const opcoesTanque = tanques.map((t) => ({
    valor: t.id,
    rotulo: `${t.nome} · ${t.tipo_combustivel} (${litrosFmt(t.nivel_atual)} de ${litrosFmt(t.capacidade)} L)`,
  }));

  return (
    <View style={styles.raiz}>
      <View style={styles.cabecalho}>
        <Text style={styles.subtitulo}>Compras de combustível</Text>
        <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
          <Text style={styles.botaoNovoTexto}>+ Nova</Text>
        </Pressable>
      </View>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      <FlatList
        data={entradas}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={filtros}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => {
              setAtualizando(true);
              carregarApoio();
              carregarLista(1);
            }}
          />
        }
        ListEmptyComponent={
          !carregando && !erro ? <Text style={styles.vazio}>Nenhuma entrada registrada.</Text> : null
        }
        ListFooterComponent={
          pagina < ultimaPagina ? (
            <Pressable
              style={styles.maisBotao}
              disabled={carregandoMais}
              onPress={() => {
                setCarregandoMais(true);
                carregarLista(pagina + 1);
              }}
            >
              {carregandoMais ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.maisTexto}>
                  Carregar mais ({entradas.length} de {total})
                </Text>
              )}
            </Pressable>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.caixa}>
            <View style={styles.topo}>
              <Text style={styles.principal}>
                {item.tanque.nome} · +{litrosFmt(item.litros)} L
              </Text>
              <Pressable onPress={() => excluir(item.id)}>
                <Text style={[styles.excluir, confirmandoId === item.id && styles.excluirAtivo]}>
                  {confirmandoId === item.id ? 'Confirmar exclusão' : 'Excluir'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.detalhe}>
              {dataBR(item.data)} · {moeda(item.valor_total)} ·{' '}
              {moeda(Number(item.valor_total) / Number(item.litros))}/L
            </Text>
            {item.custo_medio_apos != null && (
              <Text style={styles.custo}>
                Custo médio do tanque após esta entrada: {moedaL(item.custo_medio_apos)}
              </Text>
            )}
            <Text style={styles.detalhe}>
              {item.nota_fiscal
                ? `NF ${item.nota_fiscal.numero} · ${item.nota_fiscal.fornecedor}`
                : 'Sem nota fiscal'}
            </Text>
            {item.nota_fiscal?.foto_url ? (
              <Pressable onPress={() => setFotoAberta(item.nota_fiscal.foto_url)}>
                <Text style={styles.verFoto}>Ver foto da nota</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />

      {/* Formulário de nova entrada */}
      <Modal visible={formAberto} animationType="slide" onRequestClose={fechar}>
        <ScrollView
          style={styles.modal}
          contentContainerStyle={styles.formConteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Cabecalho titulo="Nova entrada" aoVoltar={fechar} sangrar />

          <SeletorLista
            rotulo="Tanque"
            valor={form.tanque_id}
            opcoes={opcoesTanque}
            aoMudar={(id) => mudar('tanque_id', id)}
            placeholder="Escolher tanque…"
            placeholderBusca="Buscar tanque…"
            vazio="Nenhum tanque cadastrado."
          />

          <Campo
            rotulo="Data (dd/mm/aaaa)"
            value={form.data}
            onChangeText={(v) => mudar('data', v)}
            maxLength={10}
          />
          <Campo
            rotulo="Litros"
            value={form.litros}
            onChangeText={(v) => mudar('litros', v)}
            keyboardType="decimal-pad"
          />
          <Campo
            rotulo="Valor total da compra"
            placeholder="R$ 0,00"
            value={form.valor_total}
            onChangeText={(v) => mudar('valor_total', mascaraMoeda(v))}
            keyboardType="numeric"
          />

          <Text style={styles.secao}>Nota fiscal (opcional)</Text>
          <Campo
            rotulo="Número da nota"
            value={form.nf_numero}
            onChangeText={(v) => mudar('nf_numero', v)}
            maxLength={20}
          />
          <Campo
            rotulo="Fornecedor"
            value={form.nf_fornecedor}
            onChangeText={(v) => mudar('nf_fornecedor', v)}
          />
          <Text style={styles.rotulo}>Foto da nota (opcional)</Text>
          <View style={styles.opcoes}>
            <Opcao texto={foto ? 'Trocar foto' : 'Escolher foto'} ativo={false} aoTocar={escolherFoto} />
            {foto && <Opcao texto="Remover foto" ativo={false} aoTocar={() => setFoto(null)} />}
          </View>
          {foto && (
            <>
              <Text style={styles.avisoFoto}>Foto selecionada: {foto.fileName ?? 'imagem'}</Text>
              <Image source={{ uri: foto.uri }} style={styles.fotoPreview} resizeMode="contain" />
            </>
          )}

          {previa && (
            <View style={styles.previa}>
              <Text style={styles.previaTitulo}>Custo médio do tanque</Text>
              <Text style={styles.previaLinha}>Esta compra: {moedaL(previa.compra)}</Text>
              <Text style={styles.previaLinha}>
                Antes: {previa.antes != null ? moedaL(previa.antes) : 'tanque vazio'}
              </Text>
              <Text style={styles.previaDepois}>Depois: {moedaL(previa.depois)}</Text>
            </View>
          )}

          {erroForm && <Text style={styles.erroForm}>{erroForm}</Text>}

          <Pressable
            style={[styles.botao, salvando && styles.desativado]}
            onPress={salvar}
            disabled={salvando}
          >
            {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>Registrar</Text>}
          </Pressable>

          <Pressable style={styles.botaoSecundario} onPress={fechar} disabled={salvando}>
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>
        </ScrollView>
      </Modal>

      <Modal visible={!!fotoAberta} transparent animationType="fade" onRequestClose={() => setFotoAberta(null)}>
        <Pressable style={styles.fotoModal} onPress={() => setFotoAberta(null)}>
          {fotoAberta ? (
            <Image source={{ uri: fotoAberta }} style={styles.fotoGrande} resizeMode="contain" />
          ) : null}
          <Text style={styles.fecharFoto}>Toque para fechar</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subtitulo: { fontSize: 16, fontWeight: '600', color: '#374151' },
  botaoNovo: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 14 },
  filtros: { marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipAtivo: { backgroundColor: '#dc2626' },
  chipTexto: { fontSize: 13, fontWeight: '600', color: '#374151' },
  resumo: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  principal: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  verFoto: { fontSize: 13, color: '#dc2626', fontWeight: '600', marginTop: 6 },
  excluir: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  excluirAtivo: { color: '#dc2626' },
  custo: { fontSize: 13, color: '#dc2626', marginTop: 4, fontWeight: '500' },
  maisBotao: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  maisTexto: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
  previa: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 16 },
  previaTitulo: { fontSize: 14, fontWeight: '600', color: '#991b1b', marginBottom: 4 },
  previaLinha: { fontSize: 14, color: '#374151', marginTop: 2 },
  previaDepois: { fontSize: 16, fontWeight: '700', color: '#991b1b', marginTop: 4 },
  avisoFoto: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  fotoPreview: { height: 160, borderRadius: 8, marginBottom: 12, backgroundColor: '#e5e7eb' },
  fotoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  fotoGrande: { width: '100%', height: '80%', maxWidth: 720 },
  fecharFoto: { color: '#fff', marginTop: 12, fontWeight: '600' },

  modal: { flex: 1, backgroundColor: '#f3f4f6' },
  secao: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 8, marginBottom: 10 },
  formConteudo: {
    paddingBottom: 40,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  grupo: { marginBottom: 12 },
  rotulo: { fontSize: 14, color: '#374151', marginBottom: 6, fontWeight: '500' },
  campo: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  opcao: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  opcaoAtiva: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
  erroForm: { color: '#dc2626', marginBottom: 12 },
  botao: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: '#374151', fontSize: 16, fontWeight: '600' },
});
