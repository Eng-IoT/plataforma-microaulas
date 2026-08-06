# Plataforma de Microaulas — SENAI Hub

Plataforma dinâmica em HTML5, CSS, JavaScript e Firebase, pronta para GitHub Pages ou Vercel.

## Executar localmente

Abra um terminal nesta pasta e execute:

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Publicar

- GitHub Pages: publique a pasta como raiz do repositório.
- Vercel: importe o repositório e mantenha o framework como `Other`.

## Logomarca

O arquivo esperado é `assets/brand/logo-senai-hub.webp`.

## Gerenciador de microaulas

O botão **Administrar** abre o login protegido pelo Firebase Authentication. O administrador autorizado pode cadastrar, editar, ordenar, publicar, despublicar e excluir microaulas, além de enviar e reordenar imagens pelo celular.

### Ativação no Firebase

1. Em **Authentication > Sign-in method**, habilite **E-mail/senha**.
2. Em **Firestore Database > Regras**, substitua o conteúdo pelo arquivo `firestore.rules` e publique.
3. Em **Storage > Regras**, substitua o conteúdo pelo arquivo `storage.rules` e publique.
4. O Cloud Storage para novos projetos exige o plano Blaze. Defina alertas de orçamento no Google Cloud antes de utilizá-lo.

As regras permitem leitura pública das microaulas e restringem qualquer gravação ao UID administrativo configurado.

### Estrutura online

- Coleção Firestore: `microaulas`
- Pasta do Storage: `microaulas/{documento}/{arquivo}`
- As sete microaulas incluídas no projeto funcionam como base local e continuam disponíveis se o Firebase estiver temporariamente indisponível.
