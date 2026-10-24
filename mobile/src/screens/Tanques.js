import { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import Cabecalho from '../components/Cabecalho';
import Entradas from './Entradas';

// Funções de formatação: 15000 -> "15.000" | "273.50" -> "273,5"
const separar = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const litrosFmt = (n) => {
  const [inteiro, decimal] = String(Number(n)).split('.');
  return separar(inteiro) + (decimal ? `,${decimal}` : '');
};
const percentual = (t) =>
  Number(t.capacidade) > 0 ? (Number(t.nivel_atual) / Number(t.capacidade)) * 100 : 0;

// Mensagem amigável para qualquer erro de comunicação com a API.
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

// Atalhos para preencher o tipo de combustível.
const TIPOS = ['Diesel S10', 'Diesel S500', 'Gasolina', 'Etanol'];

// Formulário em branco para um tanque novo.
const formVazio = () => ({
  nome: '',
  tipo_combustivel: '',
  capacidade: '',
  nivel_atual: '0',
  principal: false,
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

export default function Tanques() {
  const [aba, setAba] = useState('tanques'); // 'tanques' ou 'entradas'
  const [tanques, setTanques] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);

  // editando: null = formulário fechado | 'novo' = cadastrando | objeto = alterando aquele tanque
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const [confirmando, setConfirmando] = useState(false); // pede um segundo toque para excluir

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setTanques(await api('/tanques'));
    } catch (e) {
      setErro('Não foi possível carregar os tanques. Verifique se o servidor está ligado.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  // Recarrega toda vez que a aba é aberta (os níveis mudam a cada abastecimento).
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar, aba])
  );

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const abrirNovo = () => {
    setForm(formVazio());
    setErroForm(null);
    setConfirmando(false);
    setEditando('novo');
  };

  const abrirEdicao = (t) => {
    setForm({
      nome: t.nome,
      tipo_combustivel: t.tipo_combustivel,
      capacidade: String(Number(t.capacidade)),
      nivel_atual: String(Number(t.nivel_atual)),
      principal: Boolean(t.principal),
    });
    setErroForm(null);
    setConfirmando(false);
    setEditando(t);
  };

  const fechar = () => {
    setEditando(null);
    setErroForm(null);
    setConfirmando(false);
  };

  const salvar = async () => {
    const capacidade = Number(String(form.capacidade).replace(',', '.'));
    const nivel = Number(String(form.nivel_atual || '0').replace(',', '.'));

    if (!form.nome.trim() || !form.tipo_combustivel.trim()) {
      setErroForm('Preencha o nome e o tipo de combustível.');
      return;
    }
    if (!(capacidade > 0)) {
      setErroForm('Informe a capacidade em litros.');
      return;
    }
    if (editando === 'novo' && Number.isNaN(nivel)) {
      setErroForm('Nível inicial inválido.');
      return;
    }

    const corpo = {
      nome: form.nome.trim(),
      tipo_combustivel: form.tipo_combustivel.trim(),
      capacidade,
      principal: form.principal,
    };
    // O nível só é enviado no cadastro. Depois ele muda sozinho (entradas e abastecimentos).
    if (editando === 'novo') corpo.nivel_atual = nivel;

    setSalvando(true);
    setErroForm(null);
    try {
      if (editando === 'novo') {
        await api('/tanques', { metodo: 'POST', corpo });
      } else {
        await api(`/tanques/${editando.id}`, { metodo: 'PUT', corpo });
      }
      fechar();
      await carregar();
    } catch (e) {
      setErroForm(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    // Primeiro toque: pede confirmação. Segundo toque: exclui.
    if (!confirmando) {
      setConfirmando(true);
      return;
    }

    setSalvando(true);
    setErroForm(null);
    try {
      await api(`/tanques/${editando.id}`, { metodo: 'DELETE' });
      fechar();
      await carregar();
    } catch (e) {
      setErroForm(mensagemDe(e));
      setConfirmando(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="GESTÃO DE TANQUES">
        {aba === 'tanques' && (
          <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
            <Text style={styles.botaoNovoTexto}>+ Novo tanque</Text>
          </Pressable>
        )}
      </Cabecalho>

      <View style={styles.segmentos}>
        {[
          ['tanques', 'Tanques'],
          ['entradas', 'Entradas'],
        ].map(([valor, rotulo]) => (
          <Pressable
            key={valor}
            onPress={() => setAba(valor)}
            style={[styles.segmento, aba === valor && styles.segmentoAtivo]}
          >
            <Text style={[styles.segmentoTexto, aba === valor && { color: '#fff' }]}>{rotulo}</Text>
          </Pressable>
        ))}
      </View>

      {aba === 'entradas' && <Entradas />}

      {aba === 'tanques' && (
        <>
          {erro && <Text style={styles.erro}>{erro}</Text>}
          {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

          <FlatList
            data={tanques}
            keyExtractor={(item) => String(item.id)}
            refreshControl={
              <RefreshControl
                refreshing={atualizando}
                onRefresh={() => {
                  setAtualizando(true);
                  carregar();
                }}
              />
            }
            ListEmptyComponent={
              !carregando && !erro ? <Text style={styles.vazio}>Nenhum tanque cadastrado.</Text> : null
            }
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => {
              const pct = percentual(item);
              const baixo = pct < 20;
              return (
                <Pressable style={styles.caixa} onPress={() => abrirEdicao(item)}>
                  <View style={styles.topo}>
                    <Text style={styles.nomeItem}>
                      {item.nome} · {item.tipo_combustivel}
                      {item.principal ? ' · PRINCIPAL' : ''}
                    </Text>
                    {baixo && <Text style={styles.alerta}>NÍVEL BAIXO</Text>}
                  </View>
                  <View style={styles.barraFundo}>
                    <View
                      style={[
                        styles.barra,
                        { width: `${Math.min(pct, 100)}%`, backgroundColor: baixo ? '#dc2626' : '#16a34a' },
                      ]}
                    />
                  </View>
                  <Text style={styles.detalhe}>
                    {litrosFmt(item.nivel_atual)} L de {litrosFmt(item.capacidade)} L ({pct.toFixed(1).replace('.', ',')}%)
                  </Text>
                </Pressable>
              );
            }}
          />
        </>
      )}

      {/* Formulário de cadastro e edição */}
      <Modal visible={editando !== null} animationType="slide" onRequestClose={fechar}>
        <ScrollView
          style={styles.tela}
          contentContainerStyle={styles.formConteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.titulo}>{editando === 'novo' ? 'Novo tanque' : 'Editar tanque'}</Text>

          <Campo rotulo="Nome" value={form.nome} onChangeText={(v) => mudar('nome', v)} />

          <Campo
            rotulo="Tipo de combustível"
            value={form.tipo_combustivel}
            onChangeText={(v) => mudar('tipo_combustivel', v)}
          />
          <View style={styles.opcoes}>
            {TIPOS.map((tipo) => (
              <Pressable
                key={tipo}
                onPress={() => mudar('tipo_combustivel', tipo)}
                style={[styles.opcao, form.tipo_combustivel === tipo && styles.opcaoAtiva]}
              >
                <Text style={[styles.opcaoTexto, form.tipo_combustivel === tipo && { color: '#fff' }]}>
                  {tipo}
                </Text>
              </Pressable>
            ))}
          </View>

          <Campo
            rotulo="Capacidade (litros)"
            value={form.capacidade}
            onChangeText={(v) => mudar('capacidade', v)}
            keyboardType="decimal-pad"
          />

          {editando === 'novo' ? (
            <Campo
              rotulo="Nível inicial (litros)"
              value={form.nivel_atual}
              onChangeText={(v) => mudar('nivel_atual', v)}
              keyboardType="decimal-pad"
            />
          ) : (
            <View style={styles.grupo}>
              <Text style={styles.rotulo}>Nível atual</Text>
              <Text style={styles.somenteLeitura}>
                {litrosFmt(form.nivel_atual)} L (muda com as entradas e os abastecimentos)
              </Text>
            </View>
          )}

          <Text style={styles.rotulo}>Tanque principal da base?</Text>
          <View style={styles.opcoes}>
            {[
              [true, 'Sim'],
              [false, 'Não'],
            ].map(([valor, rotulo]) => (
              <Pressable
                key={rotulo}
                onPress={() => mudar('principal', valor)}
                style={[styles.opcao, form.principal === valor && styles.opcaoAtiva]}
              >
                <Text style={[styles.opcaoTexto, form.principal === valor && { color: '#fff' }]}>
                  {rotulo}
                </Text>
              </Pressable>
            ))}
          </View>

          {erroForm && <Text style={styles.erroForm}>{erroForm}</Text>}

          <Pressable
            style={[styles.botao, salvando && styles.desativado]}
            onPress={salvar}
            disabled={salvando}
          >
            {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>Salvar</Text>}
          </Pressable>

          <Pressable style={styles.botaoSecundario} onPress={fechar} disabled={salvando}>
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>

          {editando !== 'novo' && editando !== null && (
            <Pressable
              style={[styles.botaoExcluir, confirmando && styles.botaoExcluirAtivo]}
              onPress={excluir}
              disabled={salvando}
            >
              <Text style={[styles.botaoExcluirTexto, confirmando && { color: '#fff' }]}>
                {confirmando ? 'Toque de novo para confirmar a exclusão' : 'Excluir tanque'}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingTop: 56 },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  tituloTela: { fontSize: 20, fontWeight: 'bold', color: '#111827', flexShrink: 1, marginRight: 8 },
  botaoNovo: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  botaoNovoTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
  segmentos: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  segmento: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  segmentoAtivo: { backgroundColor: '#2563eb' },
  segmentoTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  nomeItem: { fontSize: 15, fontWeight: '600', color: '#111827' },
  alerta: { color: '#dc2626', fontWeight: 'bold', fontSize: 12 },
  barraFundo: { height: 10, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden' },
  barra: { height: 10 },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 6 },

  formConteudo: { paddingBottom: 40, width: '100%', maxWidth: 520, alignSelf: 'center' },
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
  somenteLeitura: { fontSize: 15, color: '#111827' },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  opcao: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  opcaoAtiva: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  opcaoTexto: { fontSize: 13, fontWeight: '600', color: '#374151' },
  erroForm: { color: '#dc2626', marginBottom: 12 },
  botao: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botaoSecundario: { padding: 14, alignItems: 'center', marginTop: 4 },
  botaoSecundarioTexto: { color: '#374151', fontSize: 16, fontWeight: '600' },
  botaoExcluir: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  botaoExcluirAtivo: { backgroundColor: '#dc2626' },
  botaoExcluirTexto: { color: '#dc2626', fontSize: 15, fontWeight: '600' },
});