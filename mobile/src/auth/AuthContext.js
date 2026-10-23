import { createContext, useContext, useEffect, useState } from 'react';
import { armazenamento } from '../storage';
import { api, definirAoExpirar } from '../api';

// O contexto deixa qualquer tela saber quem está logado, sem passar dados de tela em tela.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true); // true enquanto lê a sessão guardada

  // Apaga a sessão só no aparelho (não chama a API).
  const limparSessao = async () => {
    await armazenamento.apagar('token');
    await armazenamento.apagar('usuario');
    setToken(null);
    setUsuario(null);
  };

  useEffect(() => {
    // Ao abrir o app, recupera a sessão guardada (se existir).
    (async () => {
      const tokenGuardado = await armazenamento.ler('token');
      const usuarioGuardado = await armazenamento.ler('usuario');
      if (tokenGuardado) {
        setToken(tokenGuardado);
        setUsuario(usuarioGuardado ? JSON.parse(usuarioGuardado) : null);
      }
      setCarregando(false);
    })();

    // Se o servidor recusar o token, volta para a tela de login.
    definirAoExpirar(limparSessao);
  }, []);

  // Envia e-mail e senha; se estiverem certos, guarda o token.
  const entrar = async (email, senha) => {
    const dados = await api('/login', {
      metodo: 'POST',
      corpo: { email, password: senha },
    });
    await armazenamento.gravar('token', dados.token);
    await armazenamento.gravar('usuario', JSON.stringify(dados.usuario));
    setToken(dados.token);
    setUsuario(dados.usuario);
  };

  // Avisa o servidor (para apagar o token lá) e limpa a sessão no aparelho.
  const sair = async () => {
    try {
      await api('/logout', { metodo: 'POST' });
    } catch (e) {
      // Mesmo sem conexão, o usuário precisa conseguir sair.
    }
    await limparSessao();
  };

  return (
    <AuthContext.Provider value={{ token, usuario, carregando, entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

// Atalho: const { sair } = useAuth();
export const useAuth = () => useContext(AuthContext);