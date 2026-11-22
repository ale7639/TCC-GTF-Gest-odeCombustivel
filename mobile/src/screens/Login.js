// =====================================================================================
// Login.js — tela de entrada do sistema (admin entra com e-mail, motorista com CPF).
//
// O que a tela faz:
//   1) recebe login e senha e chama entrar() do AuthContext (que chama POST /api/login);
//   2) o olho ao lado da senha mostra ou esconde o que foi digitado;
//   3) "Esqueci minha senha" abre o WhatsApp do administrador com uma mensagem pronta.
//      Não existe recuperação automática: quem define a nova senha do motorista é o admin,
//      na tela Gestão de motoristas (e o sistema derruba as sessões abertas dele).
// =====================================================================================

import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,           // abre links fora do app (aqui, o WhatsApp)
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
// Biblioteca de ícones (a mesma do menu): usada no olho da senha.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { WHATSAPP_ADMIN } from '../config';
// linkWhatsApp monta o endereço https://wa.me/55... com a mensagem; somenteDigitos tira pontuação.
import { linkWhatsApp, somenteDigitos } from '../utils/formatos';
import { cores } from '../ui/tema';

// LOGIN / AUTH — admin (e-mail) ou motorista (CPF) + pedido de nova senha.
export default function Login() {
  const { entrar } = useAuth();
  const [login, setLogin] = useState(''); // e-mail (admin) ou CPF (motorista)
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  // false = senha escondida (bolinhas); true = senha visível. Começa escondida.
  const [mostrarSenha, setMostrarSenha] = useState(false);

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
      setErro('Informe o e-mail ou CPF e a senha.');
      return;
    }

    setErro(null);
    setEnviando(true);
    try {
      await entrar(login.trim(), senha);
      // Se deu certo, o App troca esta tela pelo painel automaticamente.
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

  // "Esqueci minha senha": abre o WhatsApp do admin com a mensagem já escrita.
  // Se o motorista já digitou o CPF (11 números), ele vai junto na mensagem.
  const esqueciSenha = () => {
    const cpf = somenteDigitos(login);
    const mensagem =
      'Olá! Sou motorista e esqueci minha senha do app da frota.' +
      (cpf.length === 11 ? ` Meu CPF é ${login.trim()}.` : ' Meu CPF é: ');
    const link = linkWhatsApp(WHATSAPP_ADMIN, mensagem);
    // linkWhatsApp devolve null se o número do config.js estiver incompleto.
    if (link) {
      Linking.openURL(link);
    } else {
      setErro('Fale com o administrador da frota para receber uma nova senha.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.caixa}>
        <Text style={styles.titulo}>Gestão de Frota</Text>
        <Text style={styles.subtitulo}>Administrador: e-mail · Motorista: CPF</Text>

        <TextInput
          style={styles.campo}
          placeholder="E-mail ou CPF"
          value={login}
          onChangeText={setLogin}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Campo de senha com o olho dentro: a borda fica na View, o TextInput ocupa o espaço que sobra */}
        <View style={styles.campoSenha}>
          <TextInput
            style={styles.inputSenha}
            placeholder="Senha"
            value={senha}
            onChangeText={setSenha}
            // secureTextEntry = esconde com bolinhas. "!mostrarSenha" = esconde quando NÃO está mostrando.
            secureTextEntry={!mostrarSenha}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={enviar}
          />
          {/* Tocar no olho inverte o estado (true vira false e vice-versa) */}
          <Pressable
            onPress={() => setMostrarSenha((atual) => !atual)}
            style={styles.olho}
            hitSlop={8}
            accessibilityLabel={mostrarSenha ? 'Esconder a senha' : 'Mostrar a senha'}
          >
            <MaterialCommunityIcons
              name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={cores.textoSecundario}
            />
          </Pressable>
        </View>

        {erro && <Text style={styles.erro}>{erro}</Text>}

        <Pressable
          style={[styles.botao, enviando && styles.botaoDesativado]}
          onPress={enviar}
          disabled={enviando}
        >
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botaoTexto}>Entrar</Text>
          )}
        </Pressable>

        {/* Link para o motorista pedir uma nova senha ao administrador */}
        <Pressable onPress={esqueciSenha} style={styles.esqueci} hitSlop={6}>
          <MaterialCommunityIcons name="whatsapp" size={18} color={cores.primaria} />
          <Text style={styles.esqueciTexto}>Esqueci minha senha (falar com o administrador)</Text>
        </Pressable>
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
  tela: { flex: 1, backgroundColor: cores.fundo, justifyContent: 'center', padding: 24 },
  caixa: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: cores.texto },
  subtitulo: { fontSize: 14, color: cores.textoSecundario, marginTop: 4, marginBottom: 20 },
  campo: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  // Mesma aparência do "campo", mas em linha: texto à esquerda, olho à direita.
  campoSenha: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    marginBottom: 12,
  },
  inputSenha: { flex: 1, padding: 12, fontSize: 16 },
  olho: { paddingHorizontal: 12, paddingVertical: 10 },
  erro: { color: cores.perigo, marginBottom: 12 },
  botao: {
    backgroundColor: cores.primaria,
    borderRadius: 8,
    padding: 14,
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
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  esqueci: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  esqueciTexto: { color: cores.primaria, fontSize: 14, fontWeight: '600' },
});