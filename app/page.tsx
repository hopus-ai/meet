'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { encodePassphrase, generateRoomId, randomString } from '@/lib/client-utils';
import styles from '../styles/Home.module.css';

function StartMeeting() {
  const router = useRouter();
  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));

  const startMeeting = () => {
    if (e2ee) {
      router.push(`/rooms/${generateRoomId()}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      router.push(`/rooms/${generateRoomId()}`);
    }
  };

  return (
    <div className={styles.tabContainer}>
      <div className={styles.tabContent}>
        <p style={{ margin: 0, textAlign: 'center' }}>
          Inicie uma videoconferência instantaneamente.
        </p>
        <button
          style={{ marginTop: '1rem', width: '100%' }}
          className="lk-button"
          onClick={startMeeting}
        >
          Iniciar Reunião
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'center' }}>
            <input
              id="use-e2ee"
              type="checkbox"
              checked={e2ee}
              onChange={(ev) => setE2ee(ev.target.checked)}
            />
            <label htmlFor="use-e2ee">Criptografia ponta-a-ponta</label>
          </div>
          {e2ee && (
            <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'center' }}>
              <label htmlFor="passphrase">Senha</label>
              <input
                id="passphrase"
                type="password"
                value={sharedPassphrase}
                onChange={(ev) => setSharedPassphrase(ev.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <div className="header">
          <img src="/images/hopus-meet-logo.svg" alt="Hopus Meet" width="360" height="50" />
          <h2>
            Videoconferência empresarial segura e escalável.
            <br />
            Reuniões em tempo real com qualidade profissional.
          </h2>
        </div>
        <StartMeeting />
      </main>
      <footer data-lk-theme="default">
        <a href="https://hopus.ai" rel="noopener">
          Hopus AI
        </a>{' '}
        - Agente de IA para atendimento empresarial
      </footer>
    </>
  );
}
