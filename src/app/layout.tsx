import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
export const metadata:Metadata={title:'Crownfall — Королевская арена',description:'Соберите колоду, сражайтесь на арене, создавайте кланы и станьте легендой Crownfall.'};
export default function RootLayout({children}:{children:ReactNode}) { return <html lang="ru"><body>{children}</body></html>; }
