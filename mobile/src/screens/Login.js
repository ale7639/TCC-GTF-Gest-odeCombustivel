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

export default function Login() {
  const { entrar } = useAuth();
  const [login, setLogin] = useState(''); // e-mail (admin) ou CPF (motorista)
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  // false = senha escondida (bolinhas); true = senha visível. Começa escondida.
  const [mostrarSenha, setMostrarSenha] = useState(false);

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
      setErro(semConexao ? 'Não foi possível conectar ao servidor.' : e.message);
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
  },
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