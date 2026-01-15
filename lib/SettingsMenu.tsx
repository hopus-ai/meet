'use client';
import * as React from 'react';
import { Track } from 'livekit-client';
import {
  useMaybeLayoutContext,
  MediaDeviceMenu,
  TrackToggle,
  useRoomContext,
  useIsRecording,
} from '@livekit/components-react';
import styles from '../styles/SettingsMenu.module.css';
import { CameraSettings } from './CameraSettings';
import { MicrophoneSettings } from './MicrophoneSettings';
/**
 * @alpha
 */
export interface SettingsMenuProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * @alpha
 */
export function SettingsMenu(props: SettingsMenuProps) {
  const layoutContext = useMaybeLayoutContext();
  const room = useRoomContext();
  const recordingEndpoint = process.env.NEXT_PUBLIC_LK_RECORD_ENDPOINT;

  // Check if the local participant has recording permission
  const canRecord = React.useMemo(() => {
    try {
      const metadata = room.localParticipant?.metadata;
      if (metadata) {
        const parsed = JSON.parse(metadata);
        return parsed.canRecord === true;
      }
    } catch {
      // Invalid metadata, default to no permission
    }
    return false;
  }, [room.localParticipant?.metadata]);

  const settings = React.useMemo(() => {
    return {
      media: { camera: true, microphone: true, label: 'Media Devices', speaker: true },
      recording: recordingEndpoint && canRecord ? { label: 'Recording' } : undefined,
    };
  }, [canRecord]);

  const tabs = React.useMemo(
    () => Object.keys(settings).filter((t) => t !== undefined) as Array<keyof typeof settings>,
    [settings],
  );
  const [activeTab, setActiveTab] = React.useState(tabs[0]);

  const livekitIsRecording = useIsRecording();
  const [localRecordingState, setLocalRecordingState] = React.useState<boolean | null>(null);
  const [processingRecRequest, setProcessingRecRequest] = React.useState(false);

  // Use local state if set, otherwise fall back to LiveKit state
  const isRecording = localRecordingState !== null ? localRecordingState : livekitIsRecording;

  console.log('Recording state:', { livekitIsRecording, localRecordingState, isRecording });

  // Sync local state with LiveKit state when LiveKit catches up
  React.useEffect(() => {
    // Only clear local override when LiveKit has caught up to our expected state
    if (localRecordingState !== null && livekitIsRecording === localRecordingState) {
      console.log('LiveKit caught up, clearing local override');
      setLocalRecordingState(null);
    }
  }, [livekitIsRecording, localRecordingState]);

  const toggleRoomRecording = async () => {
    if (!recordingEndpoint) {
      alert('Recording endpoint not configured');
      return;
    }
    if (room.isE2EEEnabled) {
      alert('Recording of encrypted meetings is currently not supported');
      return;
    }
    setProcessingRecRequest(true);

    // Get the participant's identity to send for server-side validation
    const identity = room.localParticipant?.identity;
    console.log('Recording request:', { roomName: room.name, identity, isRecording });

    try {
      let response: Response;
      if (isRecording) {
        response = await fetch(recordingEndpoint + `/stop?roomName=${room.name}&identity=${encodeURIComponent(identity || '')}`);
      } else {
        response = await fetch(recordingEndpoint + `/start?roomName=${room.name}&identity=${encodeURIComponent(identity || '')}`);
      }

      const responseText = await response.text();
      console.log('Recording response:', response.status, responseText);

      if (response.ok) {
        // Update local state immediately for responsive UI
        const newState = !isRecording;
        console.log('Recording success, setting state to:', newState, 'was:', isRecording);
        setLocalRecordingState(newState);
        setProcessingRecRequest(false);
      } else {
        alert(`Recording failed: ${responseText}`);
        setProcessingRecRequest(false);
      }
    } catch (error) {
      console.error('Recording error:', error);
      alert(`Recording error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setProcessingRecRequest(false);
    }
  };

  return (
    <div className="settings-menu" style={{ width: '100%', position: 'relative' }} {...props}>
      <div className={styles.tabs}>
        {tabs.map(
          (tab) =>
            settings[tab] && (
              <button
                className={`${styles.tab} lk-button`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-pressed={tab === activeTab}
              >
                {
                  // @ts-ignore
                  settings[tab].label
                }
              </button>
            ),
        )}
      </div>
      <div className="tab-content">
        {activeTab === 'media' && (
          <>
            {settings.media && settings.media.camera && (
              <>
                <h3>Camera</h3>
                <section>
                  <CameraSettings />
                </section>
              </>
            )}
            {settings.media && settings.media.microphone && (
              <>
                <h3>Microphone</h3>
                <section>
                  <MicrophoneSettings />
                </section>
              </>
            )}
            {settings.media && settings.media.speaker && (
              <>
                <h3>Speaker & Headphones</h3>
                <section className="lk-button-group">
                  <span className="lk-button">Audio Output</span>
                  <div className="lk-button-group-menu">
                    <MediaDeviceMenu kind="audiooutput"></MediaDeviceMenu>
                  </div>
                </section>
              </>
            )}
          </>
        )}
        {activeTab === 'recording' && (
          <>
            <h3>Record Meeting</h3>
            <section>
              <p>
                {isRecording
                  ? 'Meeting is currently being recorded'
                  : 'No active recordings for this meeting'}
              </p>
              <button disabled={processingRecRequest} onClick={() => toggleRoomRecording()}>
                {isRecording ? 'Stop' : 'Start'} Recording
              </button>
            </section>
          </>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
        <button
          className={`lk-button`}
          onClick={() => layoutContext?.widget.dispatch?.({ msg: 'toggle_settings' })}
        >
          Close
        </button>
      </div>
    </div>
  );
}
