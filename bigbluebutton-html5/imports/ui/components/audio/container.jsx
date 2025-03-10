import React from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import { withModalMounter } from '/imports/ui/components/modal/service';
import { injectIntl, defineMessages } from 'react-intl';
import _ from 'lodash';
import Breakouts from '/imports/api/breakouts';
import { notify } from '/imports/ui/services/notification';
import getFromUserSettings from '/imports/ui/services/users-settings';
import VideoPreviewContainer from '/imports/ui/components/video-preview/container';
import Service from './service';
import AudioModalContainer from './audio-modal/container';

const intlMessages = defineMessages({
  joinedAudio: {
    id: 'app.audioManager.joinedAudio',
    description: 'Joined audio toast message',
  },
  joinedEcho: {
    id: 'app.audioManager.joinedEcho',
    description: 'Joined echo test toast message',
  },
  leftAudio: {
    id: 'app.audioManager.leftAudio',
    description: 'Left audio toast message',
  },
  genericError: {
    id: 'app.audioManager.genericError',
    description: 'Generic error message',
  },
  connectionError: {
    id: 'app.audioManager.connectionError',
    description: 'Connection error message',
  },
  requestTimeout: {
    id: 'app.audioManager.requestTimeout',
    description: 'Request timeout error message',
  },
  invalidTarget: {
    id: 'app.audioManager.invalidTarget',
    description: 'Invalid target error message',
  },
  mediaError: {
    id: 'app.audioManager.mediaError',
    description: 'Media error message',
  },
  BrowserNotSupported: {
    id: 'app.audioNotification.audioFailedError1003',
    description: 'browser not supported error messsage',
  },
  reconectingAsListener: {
    id: 'app.audioNotificaion.reconnectingAsListenOnly',
    description: 'ice negociation error messsage',
  },
});


class AudioContainer extends React.Component {
  constructor(props) {
    super(props);

    this.init = props.init.bind(this);
  }

  componentDidMount() {
    this.init();
  }

  render() {
    return null;
  }
}

let didMountAutoJoin = false;

export default withModalMounter(injectIntl(withTracker(({ mountModal, intl }) => {
  const APP_CONFIG = Meteor.settings.public.app;
  const KURENTO_CONFIG = Meteor.settings.public.kurento;

  const autoJoin = getFromUserSettings('autoJoin', APP_CONFIG.autoJoin);
  const openAudioModal = mountModal.bind(
    null,
    <AudioModalContainer />,
  );
  const openVideoPreviewModal = () => new Promise((resolve) => {
    mountModal(<VideoPreviewContainer resolve={resolve} />);
  });
  if (Service.audioLocked() && Service.isConnected() && !Service.isListenOnly()) {
    Service.exitAudio();
    notify(intl.formatMessage(intlMessages.reconectingAsListener), 'info', 'audio_on');
    Service.joinListenOnly();
  }

  Breakouts.find().observeChanges({
    removed() {
      // if the user joined a breakout room, the main room's audio was
      // programmatically dropped to avoid interference. On breakout end,
      // offer to rejoin main room audio only if the user is not in audio already
      if (Service.isUsingAudio()) {
        return;
      }
      setTimeout(() => openAudioModal(), 0);
    },
  });

  const webRtcError = _.range(1001, 1011)
    .reduce((acc, value) => ({
      ...acc,
      [value]: { id: `app.audioNotification.audioFailedError${value}` },
    }), {});

  const messages = {
    info: {
      JOINED_AUDIO: intlMessages.joinedAudio,
      JOINED_ECHO: intlMessages.joinedEcho,
      LEFT_AUDIO: intlMessages.leftAudio,
    },
    error: {
      GENERIC_ERROR: intlMessages.genericError,
      CONNECTION_ERROR: intlMessages.connectionError,
      REQUEST_TIMEOUT: intlMessages.requestTimeout,
      INVALID_TARGET: intlMessages.invalidTarget,
      MEDIA_ERROR: intlMessages.mediaError,
      WEBRTC_NOT_SUPPORTED: intlMessages.BrowserNotSupported,
      ...webRtcError,
    },
  };

  return {
    init: () => {
      Service.init(messages, intl);
      Service.changeOutputDevice(document.querySelector('#remote-media').sinkId);
      if (!autoJoin || didMountAutoJoin) return;

      const enableVideo = getFromUserSettings('enableVideo', KURENTO_CONFIG.enableVideo);
      const autoShareWebcam = getFromUserSettings('autoShareWebcam', KURENTO_CONFIG.autoShareWebcam);
      if (enableVideo && autoShareWebcam) {
        openVideoPreviewModal().then(() => { openAudioModal(); didMountAutoJoin = true; });
      } else {
        openAudioModal();
        didMountAutoJoin = true;
      }
    },
  };
})(AudioContainer)));
