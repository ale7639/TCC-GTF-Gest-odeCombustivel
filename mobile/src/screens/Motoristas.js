import { useCallback, useMemo, useState } from 'react';
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

// Mensagem amigável para qualquer erro de comunicação com a API.
const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

// Formulário em branco para um motorista novo.
const formVazio = () => ({
  nome: '',
  cpf: '',
  cnh: '',
  telefone: '',
  ativo: true,
  caminhao_id: null, // null = sem caminhão
});

// Etiqueta colorida: verde para ativo, cinza para inativo.
function Etiqueta({ ativo }) {
  const cor = ativo ? '#16a34a' : '#6b7280';
  return (
    <View style={[styles.etiqueta, { backgroundColor: `${cor}22` }]}>
      <Text style={[styles.etiquetaTexto, { color: cor }]}>{ativo ? 'Ativo' : 'Inativo'}</Text>
    </View>
  );
}

// Campo de texto com rótulo em cima.
function Campo({ rotulo, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput style={styles.campo} {...props} />
    </View>
  );
}

// Botão de escolha (usado para status e para o caminhão).
function Opcao({ texto, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} style={[styles.opcao, ativo && styles.opcaoAtiva]}>
      <Text style={[styles.opcaoTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

export default function Motoristas() {
  const [motoristas, setMotoristas] = useState([]);
  const [caminhoes, setCaminhoes] = useState([]); // usados para escolher o caminhão do motorista
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');

  // editando: null = formulário fechado | 'novo' = cadastrando | objeto = alterando aquele motorista
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState(null);
  const [confirmando, setConfirmando] = useState(false); // pede um segundo toque para excluir

  // Login do motorista (e-mail e senha), definido pelo admin.
  const [acessoEmail, setAcessoEmail] = useState('');
  const [acessoSenha, setAcessoSenha] = useState('');
  const [temAcesso, setTemAcesso] = useState(false);
  const [msgAcesso, setMsgAcesso] = useState(null); // { texto, erro }
  const [salvandoAcesso, setSalvandoAcesso] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      // As duas listas são buscadas ao mesmo tempo.
      const [listaMotoristas, listaCaminhoes] = await Promise.all([
        api('/motoristas'),
        api('/caminhoes'),
      ]);
      setMotoristas(listaMotoristas);
      setCaminhoes(listaCaminhoes);
    } catch (e) {
      setErro('Não foi possível carregar os motoristas. Verifique se o servidor está ligado.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  // Recarrega a lista toda vez que a aba é aberta.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  // Filtra a lista pelo que foi digitado na busca (nome ou CPF).
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return motoristas;
    return motoristas.filter(
      (m) => m.nome.toLowerCase().includes(termo) || m.cpf.includes(termo)
    );
  }, [motoristas, busca]);

  // Caminhões que podem ser escolhidos: os sem motorista e o que já é deste motorista.
  const caminhoesDisponiveis = useMemo(() => {
    const idDele = editando && editando !== 'novo' ? editando.id : null;
    return caminhoes.filter((c) => !c.motorista_id || c.motorista_id === idDele);
  }, [caminhoes, editando]);

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const abrirNovo = () => {
    setForm(formVazio());
    setErroForm(null);
    setConfirmando(false);
    setMsgAcesso(null);
    setEditando('novo');
  };

  const abrirEdicao = (m) => {
    setForm({
      nome: m.nome,
      cpf: m.cpf,
      cnh: m.cnh,
      telefone: m.telefone ?? '',
      ativo: Boolean(m.ativo),
      caminhao_id: m.caminhao?.id ?? null,
    });
    setErroForm(null);
    setConfirmando(false);
    setAcessoEmail(m.acesso_email ?? '');
    setAcessoSenha('');
    setTemAcesso(Boolean(m.acesso_email));
    setMsgAcesso(null);
    setEditando(m);
  };

  const fechar = () => {
    setEditando(null);
    setErroForm(null);
    setConfirmando(false);
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.cpf.trim() || !form.cnh.trim()) {
      setErroForm('Preencha nome, CPF e CNH.');
      return;
    }

    const corpo = {
      nome: form.nome.trim(),
      cpf: form.cpf.trim(),
      cnh: form.cnh.trim(),
      telefone: form.telefone.trim() || null,
      ativo: form.ativo,
      caminhao_id: form.caminhao_id,
    };

    setSalvando(true);
    setErroForm(null);
    try {
      if (editando === 'novo') {
        await api('/motoristas', { metodo: 'POST', corpo });
      } else {
        await api(`/motoristas/${editando.id}`, { metodo: 'PUT', corpo });
      }
      fechar();
      await carregar();
    } catch (e) {
      setErroForm(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  // Cria ou altera o login do motorista (senha em branco = mantém a atual).
  const salvarAcesso = async () => {
    if (!acessoEmail.trim()) {
      setMsgAcesso({ texto: 'Informe o e-mail de acesso.', erro: true });
      return;
    }
    setSalvandoAcesso(true);
    setMsgAcesso(null);
    try {
      const r = await api(`/motoristas/${editando.id}/acesso`, {
        metodo: 'PUT',
        corpo: { email: acessoEmail.trim(), password: acessoSenha || null },
      });
      setTemAcesso(true);
      setAcessoSenha('');
      setMsgAcesso({ texto: r.message, erro: false });
      carregar();
    } catch (e) {
      setMsgAcesso({ texto: mensagemDe(e), erro: true });
    } finally {
      setSalvandoAcesso(false);
    }
  };

  const removerAcesso = async () => {
    setSalvandoAcesso(true);
    setMsgAcesso(null);
    try {
      await api(`/motoristas/${editando.id}/acesso`, { metodo: 'DELETE' });
      setTemAcesso(false);
      setAcessoEmail('');
      setAcessoSenha('');
      setMsgAcesso({ texto: 'Acesso removido.', erro: false });
      carregar();
    } catch (e) {
      setMsgAcesso({ texto: mensagemDe(e), erro: true });
    } finally {
      setSalvandoAcesso(false);
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
      await api(`/motoristas/${editando.id}`, { metodo: 'DELETE' });
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
      <Cabecalho titulo="GESTÃO DE MOTORISTAS">
        <Pressable style={styles.botaoNovo} onPress={abrirNovo}>
          <Text style={styles.botaoNovoTexto}>+ Novo</Text>
        </Pressable>
      </Cabecalho>

      <TextInput
        style={styles.busca}
        placeholder="Buscar por nome ou CPF"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && !erro && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}

      <FlatList
        data={filtrados}
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
          !carregando && !erro ? <Text style={styles.vazio}>Nenhum motorista encontrado.</Text> : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable style={styles.caixa} onPress={() => abrirEdicao(item)}>
            <View style={styles.topo}>
              <Text style={styles.nome}>{item.nome}</Text>
              <Etiqueta ativo={Boolean(item.ativo)} />
            </View>
            <Text style={styles.detalhe}>
              CPF {item.cpf} · CNH {item.cnh}
            </Text>
            {item.telefone ? <Text style={styles.detalhe}>{item.telefone}</Text> : null}
            <Text style={styles.detalhe}>
              Caminhão: {item.caminhao ? `${item.caminhao.placa} · ${item.caminhao.modelo}` : 'sem caminhão'}
            </Text>
            <Text style={styles.detalhe}>Acesso: {item.acesso_email ?? 'sem login'}</Text>
          </Pressable>
        )}
      />

      {/* Formulário de cadastro e edição */}
      <Modal visible={editando !== null} animationType="slide" onRequestClose={fechar}>
        <ScrollView
          style={styles.tela}
          contentContainerStyle={styles.formConteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.titulo}>{editando === 'novo' ? 'Novo motorista' : 'Editar motorista'}</Text>

          <Campo rotulo="Nome" value={form.nome} onChangeText={(v) => mudar('nome', v)} />
          <Campo
            rotulo="CPF"
            value={form.cpf}
            onChangeText={(v) => mudar('cpf', v)}
            keyboardType="numeric"
            maxLength={14}
          />
          <Campo
            rotulo="CNH"
            value={form.cnh}
            onChangeText={(v) => mudar('cnh', v)}
            keyboardType="numeric"
            maxLength={20}
          />
          <Campo
            rotulo="Telefone (opcional)"
            value={form.telefone}
            onChangeText={(v) => mudar('telefone', v)}
            keyboardType="phone-pad"
            maxLength={20}
          />

          <Text style={styles.rotulo}>Situação</Text>
          <View style={styles.opcoes}>
            <Opcao texto="Ativo" ativo={form.ativo} aoTocar={() => mudar('ativo', true)} />
            <Opcao texto="Inativo" ativo={!form.ativo} aoTocar={() => mudar('ativo', false)} />
          </View>

          <Text style={styles.rotulo}>Caminhão responsável</Text>
          <View style={styles.opcoes}>
            <Opcao
              texto="Nenhum"
              ativo={form.caminhao_id === null}
              aoTocar={() => mudar('caminhao_id', null)}
            />
            {caminhoesDisponiveis.map((c) => (
              <Opcao
                key={c.id}
                texto={c.placa}
                ativo={form.caminhao_id === c.id}
                aoTocar={() => mudar('caminhao_id', c.id)}
              />
            ))}
          </View>

          <Text style={styles.secaoAcesso}>Acesso ao sistema (login do motorista)</Text>
          {editando === 'novo' ? (
            <Text style={styles.dica}>Salve o motorista primeiro. Depois abra o cadastro dele para criar o e-mail e a senha.</Text>
          ) : (
            <View style={styles.caixaAcesso}>
              <Campo
                rotulo="E-mail de acesso"
                value={acessoEmail}
                onChangeText={setAcessoEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Campo
                rotulo={temAcesso ? 'Nova senha (deixe em branco para manter)' : 'Senha (mínimo 6 caracteres)'}
                value={acessoSenha}
                onChangeText={setAcessoSenha}
                secureTextEntry
                autoCapitalize="none"
              />
              {msgAcesso && (
                <Text style={msgAcesso.erro ? styles.erroForm : styles.okAcesso}>{msgAcesso.texto}</Text>
              )}
              <Pressable
                style={[styles.botaoAcesso, salvandoAcesso && styles.desativado]}
                onPress={salvarAcesso}
                disabled={salvandoAcesso}
              >
                {salvandoAcesso ? (
                  <ActivityIndicator color="#2563eb" />
                ) : (
                  <Text style={styles.botaoAcessoTexto}>{temAcesso ? 'Salvar acesso' : 'Criar acesso'}</Text>
                )}
              </Pressable>
              {temAcesso && (
                <Pressable onPress={removerAcesso} disabled={salvandoAcesso} style={{ marginTop: 10 }}>
                  <Text style={styles.removerAcesso}>Remover acesso</Text>
                </Pressable>
              )}
            </View>
          )}

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
                {confirmando ? 'Toque de novo para confirmar a exclusão' : 'Excluir motorista'}
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
  busca: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  erro: { color: '#dc2626', marginTop: 20, textAlign: 'center' },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nome: { fontSize: 17, fontWeight: 'bold', color: '#111827', flexShrink: 1, marginRight: 8 },
  detalhe: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  etiqueta: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  etiquetaTexto: { fontSize: 12, fontWeight: '600' },

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
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  opcao: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  opcaoAtiva: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
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
  secaoAcesso: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 8, marginBottom: 8 },
  dica: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  caixaAcesso: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16 },
  botaoAcesso: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center' },
  botaoAcessoTexto: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
  removerAcesso: { color: '#dc2626', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  okAcesso: { color: '#16a34a', marginBottom: 12, fontWeight: '600' },
});