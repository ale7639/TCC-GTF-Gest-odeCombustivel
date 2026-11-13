import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { cores } from '../ui/tema';

export default function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.');
      return;
    }

    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
      // Se deu certo, o App troca esta tela pelo painel automaticamente.
    } catch (e) {
      const semConexao = e.name === 'AbortError' || e.message === 'Network request failed';
      setErro(semConexao ? 'Não foi possível conectar ao servidor.' : e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.caixa}>
        <Text style={styles.titulo}>Gestão de Frota</Text>
        <Text style={styles.subtitulo}>Entre com sua conta de administrador</Text>

        <TextInput
          style={styles.campo}
          placeholder="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <TextInput
          style={styles.campo}
          placeholder="Senha"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          onSubmitEditing={enviar}
        />

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
  erro: { color: cores.perigo, marginBottom: 12 },
  botao: {
    backgroundColor: cores.primaria,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  botaoDesativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
});