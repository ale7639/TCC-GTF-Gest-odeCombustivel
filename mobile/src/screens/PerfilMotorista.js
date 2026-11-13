import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { useAuth } from '../auth/AuthContext';
import Cabecalho from '../components/Cabecalho';
import { mascaraTelefone, somenteDigitos } from '../utils/formatos';
import {
  BORDA,
  CINZA_FUNDO,
  RAIO_BOTAO,
  RAIO_CAMPO,
  RAIO_CARTAO,
  sombraSuave,
  TEXTO,
  TEXTO_SUAVE,
  VERMELHO,
  VERMELHO_SUAVE,
} from '../ui/tema';

const mensagemDe = (e) =>
  e.name === 'AbortError' || e.message === 'Network request failed'
    ? 'Não foi possível conectar ao servidor.'
    : e.message;

export default function PerfilMotorista() {
  const { sair, atualizarUsuario } = useAuth();
  const [dados, setDados] = useState(null);
  const [telefone, setTelefone] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConf, setSenhaConf] = useState('');
  const [erro, setErro] = useState(null);
  const [okTel, setOkTel] = useState(null);
  const [okSenha, setOkSenha] = useState(null);
  const [salvandoTel, setSalvandoTel] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const r = await api('/meu/perfil');
      setDados(r);
      setTelefone(r.motorista?.telefone ?? '');
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const salvarTelefone = async () => {
    if (somenteDigitos(telefone).length !== 11) {
      setOkTel(null);
      setErro('Informe o celular com DDD. Ex.: 44 98751-3965');
      return;
    }
    setSalvandoTel(true);
    setErro(null);
    setOkTel(null);
    try {
      const r = await api('/meu/perfil', {
        metodo: 'PUT',
        corpo: { telefone },
      });
      setDados((d) => ({ ...d, motorista: r.motorista }));
      setTelefone(r.motorista.telefone);
      await atualizarUsuario({ nome: r.motorista.nome });
      setOkTel('Telefone atualizado.');
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setSalvandoTel(false);
    }
  };

  const salvarSenha = async () => {
    if (!senhaAtual || !senhaNova) {
      setErro('Preencha a senha atual e a nova.');
      setOkSenha(null);
      return;
    }
    if (senhaNova.length < 6) {
      setErro('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (senhaNova !== senhaConf) {
      setErro('A confirmação da senha não confere.');
      return;
    }
    setSalvandoSenha(true);
    setErro(null);
    setOkSenha(null);
    try {
      const r = await api('/meu/senha', {
        metodo: 'PUT',
        corpo: {
          senha_atual: senhaAtual,
          password: senhaNova,
          password_confirmation: senhaConf,
        },
      });
      setSenhaAtual('');
      setSenhaNova('');
      setSenhaConf('');
      setOkSenha(r.message || 'Senha atualizada.');
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setSalvandoSenha(false);
    }
  };

  const m = dados?.motorista;
  const c = dados?.caminhao;

  return (
    <View style={styles.tela}>
      <Cabecalho titulo="Meu perfil" />

      <ScrollView
        contentContainerStyle={styles.conteudo}
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
        keyboardShouldPersistTaps="handled"
      >
        {erro && (
          <View style={styles.erroCaixa}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={VERMELHO} />
            <Text style={styles.erro}>{erro}</Text>
          </View>
        )}

        {!dados && !erro && <ActivityIndicator size="large" color={VERMELHO} style={{ marginTop: 40 }} />}

        {m && (
          <>
            <View style={styles.hero}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="account" size={36} color={VERMELHO} />
              </View>
              <Text style={styles.nome}>{m.nome}</Text>
              <Text style={styles.papel}>Motorista</Text>
            </View>

            <View style={styles.cartao}>
              <Text style={styles.rotuloSecao}>Seus dados</Text>
              <Linha icone="card-account-details-outline" rotulo="CPF (login)" valor={m.cpf} />
              <Linha icone="card-account-details" rotulo="CNH" valor={m.cnh} />
              <Linha
                icone="truck-outline"
                rotulo="Caminhão"
                valor={c ? `${c.placa} · ${c.modelo}` : 'Sem caminhão vinculado'}
              />
            </View>

            <View style={styles.cartao}>
              <Text style={styles.rotuloSecao}>Telefone</Text>
              <Text style={styles.dica}>Você pode atualizar o celular com WhatsApp.</Text>
              <TextInput
                style={styles.campo}
                value={telefone}
                onChangeText={(v) => {
                  setTelefone(mascaraTelefone(v));
                  setOkTel(null);
                }}
                keyboardType="phone-pad"
                maxLength={14}
                placeholder="44 98751-3965"
              />
              {okTel && <Text style={styles.ok}>{okTel}</Text>}
              <Pressable
                style={[styles.botao, salvandoTel && styles.desativado]}
                onPress={salvarTelefone}
                disabled={salvandoTel}
              >
                {salvandoTel ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botaoTexto}>Salvar telefone</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.cartao}>
              <Text style={styles.rotuloSecao}>Alterar senha</Text>
              <Text style={styles.dica}>O login continua sendo o CPF. Só a senha muda.</Text>
              <TextInput
                style={styles.campo}
                placeholder="Senha atual"
                value={senhaAtual}
                onChangeText={setSenhaAtual}
                secureTextEntry
              />
              <TextInput
                style={styles.campo}
                placeholder="Nova senha (mín. 6)"
                value={senhaNova}
                onChangeText={setSenhaNova}
                secureTextEntry
              />
              <TextInput
                style={styles.campo}
                placeholder="Confirmar nova senha"
                value={senhaConf}
                onChangeText={setSenhaConf}
                secureTextEntry
              />
              {okSenha && <Text style={styles.ok}>{okSenha}</Text>}
              <Pressable
                style={[styles.botao, salvandoSenha && styles.desativado]}
                onPress={salvarSenha}
                disabled={salvandoSenha}
              >
                {salvandoSenha ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botaoTexto}>Atualizar senha</Text>
                )}
              </Pressable>
            </View>

            <Pressable style={styles.sair} onPress={sair} accessibilityLabel="Sair">
              <MaterialCommunityIcons name="logout" size={20} color={VERMELHO} />
              <Text style={styles.sairTexto}>Sair da conta</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Linha({ icone, rotulo, valor }) {
  return (
    <View style={styles.linha}>
      <MaterialCommunityIcons name={icone} size={20} color={TEXTO_SUAVE} />
      <View style={{ flex: 1 }}>
        <Text style={styles.linhaRotulo}>{rotulo}</Text>
        <Text style={styles.linhaValor}>{valor}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CINZA_FUNDO },
  conteudo: { padding: 16, paddingBottom: 40 },
  hero: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: RAIO_CARTAO,
    padding: 20,
    marginBottom: 12,
    ...sombraSuave,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: VERMELHO_SUAVE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  nome: { fontSize: 20, fontWeight: '700', color: TEXTO, textAlign: 'center' },
  papel: { fontSize: 13, color: TEXTO_SUAVE, marginTop: 4 },
  cartao: {
    backgroundColor: '#fff',
    borderRadius: RAIO_CARTAO,
    padding: 16,
    marginBottom: 12,
    ...sombraSuave,
  },
  rotuloSecao: { fontSize: 16, fontWeight: '700', color: TEXTO, marginBottom: 8 },
  dica: { fontSize: 13, color: TEXTO_SUAVE, marginBottom: 10, lineHeight: 18 },
  linha: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  linhaRotulo: { fontSize: 12, color: TEXTO_SUAVE },
  linhaValor: { fontSize: 15, fontWeight: '600', color: TEXTO, marginTop: 2 },
  campo: {
    borderWidth: 1,
    borderColor: BORDA,
    borderRadius: RAIO_CAMPO,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  botao: {
    backgroundColor: VERMELHO,
    borderRadius: RAIO_BOTAO,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 46,
    justifyContent: 'center',
  },
  desativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ok: { color: '#16a34a', fontWeight: '600', marginBottom: 8 },
  erroCaixa: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: VERMELHO_SUAVE,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  erro: { flex: 1, color: VERMELHO, fontSize: 13 },
  sair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 4,
  },
  sairTexto: { color: VERMELHO, fontWeight: '700', fontSize: 16 },
});
