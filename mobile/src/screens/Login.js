import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { mascaraCPF, somenteDigitos } from '../utils/formatos';
import { RAIO_BOTAO, RAIO_CAMPO, RAIO_CARTAO, sombraMedia, VERMELHO, VERMELHO_SUAVE } from '../ui/tema';

// LOGIN / AUTH — admin (e-mail) ou motorista (CPF) + pedido de nova senha.
export default function Login() {
  const { entrar } = useAuth();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [esqueciAberto, setEsqueciAberto] = useState(false);
  const [cpfEsqueci, setCpfEsqueci] = useState('');
  const [msgEsqueci, setMsgEsqueci] = useState(null);
  const [enviandoEsqueci, setEnviandoEsqueci] = useState(false);

  const normalizarLogin = (valor) => {
    const digitos = somenteDigitos(valor);
    if (digitos.length === 11) return mascaraCPF(digitos);
    return valor.trim();
  };

  const aoMudarLogin = (v) => {
    const digitos = somenteDigitos(v);
    // Se parece CPF (só números), aplica máscara; senão deixa e-mail livre.
    if (digitos.length > 0 && /^[\d.\-\s]*$/.test(v)) {
      setLogin(mascaraCPF(v));
    } else {
      setLogin(v);
    }
    if (erro) setErro(null);
  };

  // LOGIN ENVIAR
  const enviar = async () => {
    if (!login.trim() || !senha) {
      setErro('Informe CPF (motorista) ou e-mail (admin) e a senha.');
      return;
    }

    setErro(null);
    setEnviando(true);
    try {
      await entrar(normalizarLogin(login), senha);
    } catch (e) {
      const semConexao = e.name === 'AbortError' || e.message === 'Network request failed';
      setErro(
        semConexao
          ? 'Não foi possível conectar ao servidor. Confira se a API está ligada.'
          : e.message || 'Não foi possível entrar. Verifique CPF/e-mail e senha.'
      );
    } finally {
      setEnviando(false);
    }
  };

  // LOGIN ESQUECI_SENHA
  const pedirSenha = async () => {
    const digitos = somenteDigitos(cpfEsqueci);
    if (digitos.length !== 11) {
      setMsgEsqueci({ ok: false, texto: 'Informe um CPF completo (11 dígitos).' });
      return;
    }
    setEnviandoEsqueci(true);
    setMsgEsqueci(null);
    try {
      const r = await api('/senha/esqueci', {
        metodo: 'POST',
        corpo: { cpf: mascaraCPF(digitos) }});
      setMsgEsqueci({ ok: true, texto: r.message || 'Pedido enviado ao administrador.' });
    } catch (e) {
      setMsgEsqueci({ ok: false, texto: e.message || 'Não foi possível enviar o pedido.' });
    } finally {
      setEnviandoEsqueci(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.faixa}>
        <MaterialCommunityIcons name="gas-station" size={36} color="#fff" />
        <Text style={styles.marca}>Gestão de combustível</Text>
        <Text style={styles.marcaSub}>Frota e abastecimento</Text>
      </View>

      <View style={styles.corpo}>
        <View style={styles.caixa}>
          <Text style={styles.titulo}>Entrar</Text>
          <Text style={styles.subtitulo}>Admin: e-mail · Motorista: CPF</Text>

          <View style={[styles.campoLinha, erro && styles.campoLinhaErro]}>
            <MaterialCommunityIcons name="account-outline" size={20} color="#9ca3af" />
            <TextInput
              style={styles.campo}
              placeholder="CPF ou e-mail"
              value={login}
              onChangeText={aoMudarLogin}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
            />
          </View>
          <View style={[styles.campoLinha, erro && styles.campoLinhaErro]}>
            <MaterialCommunityIcons name="lock-outline" size={20} color="#9ca3af" />
            <TextInput
              style={styles.campo}
              placeholder="Senha"
              value={senha}
              onChangeText={(v) => {
                setSenha(v);
                if (erro) setErro(null);
              }}
              secureTextEntry={!mostrarSenha}
              onSubmitEditing={enviar}
            />
            <Pressable
              onPress={() => setMostrarSenha((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              hitSlop={8}
              style={styles.olho}
            >
              <MaterialCommunityIcons
                name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#6b7280"
              />
            </Pressable>
          </View>

          {erro && (
            <View style={styles.erroCaixa} accessibilityRole="alert">
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={VERMELHO} />
              <Text style={styles.erro}>{erro}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.botao,
              enviando && styles.botaoDesativado,
              pressed && !enviando && styles.botaoPressionado,
            ]}
            onPress={enviar}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botaoTexto}>Entrar</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setEsqueciAberto(true);
              setMsgEsqueci(null);
              setCpfEsqueci('');
            }}
            style={styles.linkEsqueci}
            accessibilityRole="button"
            accessibilityLabel="Esqueci minha senha"
          >
            <Text style={styles.linkEsqueciTexto}>Esqueci minha senha</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={esqueciAberto} animationType="slide" onRequestClose={() => setEsqueciAberto(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitulo}>Esqueci minha senha</Text>
          <Text style={styles.modalSub}>
            Informe o CPF do motorista. O administrador receberá o pedido para redefinir a senha.
          </Text>
          <View style={styles.campoLinha}>
            <MaterialCommunityIcons name="card-account-details-outline" size={20} color="#9ca3af" />
            <TextInput
              style={styles.campo}
              placeholder="CPF"
              value={cpfEsqueci}
              onChangeText={(v) => setCpfEsqueci(mascaraCPF(v))}
              keyboardType="numeric"
              maxLength={14}
            />
          </View>
          {msgEsqueci && (
            <Text style={msgEsqueci.ok ? styles.okMsg : styles.erro}>{msgEsqueci.texto}</Text>
          )}
          <Pressable
            style={[styles.botao, enviandoEsqueci && styles.botaoDesativado]}
            onPress={pedirSenha}
            disabled={enviandoEsqueci}
          >
            {enviandoEsqueci ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botaoTexto}>Enviar pedido</Text>
            )}
          </Pressable>
          <Pressable style={styles.linkEsqueci} onPress={() => setEsqueciAberto(false)}>
            <Text style={styles.linkEsqueciTexto}>Voltar</Text>
          </Pressable>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f3f4f6' },
  faixa: {
    backgroundColor: VERMELHO,
    paddingTop: Platform.OS === 'web' ? 28 : 56,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center'},
  marca: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 10 },
  marcaSub: { color: '#fecaca', fontSize: 13, marginTop: 4 },
  corpo: { flex: 1, padding: 20, justifyContent: 'flex-start', marginTop: -8 },
  caixa: { backgroundColor: '#fff', borderRadius: RAIO_CARTAO, padding: 20, width: '100%', ...sombraMedia},
  titulo: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  subtitulo: { fontSize: 14, color: '#6b7280', marginTop: 4, marginBottom: 18 },
  campoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: RAIO_CAMPO,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    minHeight: 48},
  campoLinhaErro: { borderColor: '#fecaca' },
  campo: { flex: 1, paddingVertical: 12, fontSize: 16},
  olho: { padding: 4, alignItems: 'center', justifyContent: 'center'},
  erroCaixa: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: VERMELHO_SUAVE,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12},
  erro: { flex: 1, color: VERMELHO, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  okMsg: { color: '#16a34a', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  botao: {
    backgroundColor: VERMELHO,
    borderRadius: RAIO_BOTAO,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center'},
  botaoPressionado: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  botaoDesativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkEsqueci: { paddingVertical: 14, alignItems: 'center' },
  linkEsqueciTexto: { color: VERMELHO, fontWeight: '600', fontSize: 14 },
  modal: { flex: 1, backgroundColor: '#f3f4f6', padding: 20, paddingTop: Platform.OS === 'web' ? 40 : 64},
  modalTitulo: { fontSize: 22, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  modalSub: { fontSize: 14, color: '#6b7280', marginBottom: 18, lineHeight: 20 }});
