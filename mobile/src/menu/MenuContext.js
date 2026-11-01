import { createContext, useContext, useState } from 'react';

// Guarda se o menu lateral está aberto e oferece abrir/fechar para qualquer tela.
// "fixo" = tela larga (computador): o menu fica sempre visível e o botão ☰ some.
const MenuContext = createContext(null);

export function MenuProvider({ children, fixo = false }) {
  const [aberto, setAberto] = useState(false);

  return (
    <MenuContext.Provider
      value={{ aberto, fixo, abrir: () => setAberto(true), fechar: () => setAberto(false) }}
    >
      {children}
    </MenuContext.Provider>
  );
}

// Atalho: const { abrir } = useMenu();
export const useMenu = () => useContext(MenuContext);