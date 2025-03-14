import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { defineMessages, injectIntl, intlShape } from 'react-intl';
import Dropzone from 'react-dropzone';
import update from 'immutability-helper';
import cx from 'classnames';
import _ from 'lodash';
import logger from '/imports/startup/client/logger';
import browser from 'browser-detect';

import { notify } from '/imports/ui/services/notification';
import ModalFullscreen from '/imports/ui/components/modal/fullscreen/component';
import { withModalMounter } from '/imports/ui/components/modal/service';
import Icon from '/imports/ui/components/icon/component';
import Button from '/imports/ui/components/button/component';
import Checkbox from '/imports/ui/components/checkbox/component';
import { styles } from './styles.scss';

const propTypes = {
  intl: intlShape.isRequired,
  defaultFileName: PropTypes.string.isRequired,
  fileSizeMin: PropTypes.number.isRequired,
  fileSizeMax: PropTypes.number.isRequired,
  handleSave: PropTypes.func.isRequired,
  dispatchTogglePresentationDownloadable: PropTypes.func.isRequired,
  fileValidMimeTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  presentations: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    filename: PropTypes.string.isRequired,
    isCurrent: PropTypes.bool.isRequired,
    conversion: PropTypes.object,
    upload: PropTypes.object,
  })).isRequired,
};

const defaultProps = {
};

const intlMessages = defineMessages({
  current: {
    id: 'app.presentationUploder.currentBadge',
  },
  title: {
    id: 'app.presentationUploder.title',
    description: 'title of the modal',
  },
  message: {
    id: 'app.presentationUploder.message',
    description: 'message warning the types of files accepted',
  },
  confirmLabel: {
    id: 'app.presentationUploder.confirmLabel',
    description: 'used in the button that start the upload of the new presentation',
  },
  confirmDesc: {
    id: 'app.presentationUploder.confirmDesc',
    description: 'description of the confirm',
  },
  dismissLabel: {
    id: 'app.presentationUploder.dismissLabel',
    description: 'used in the button that close modal',
  },
  dismissDesc: {
    id: 'app.presentationUploder.dismissDesc',
    description: 'description of the dismiss',
  },
  dropzoneLabel: {
    id: 'app.presentationUploder.dropzoneLabel',
    description: 'message warning where drop files for upload',
  },
  dropzoneImagesLabel: {
    id: 'app.presentationUploder.dropzoneImagesLabel',
    description: 'message warning where drop images for upload',
  },
  browseFilesLabel: {
    id: 'app.presentationUploder.browseFilesLabel',
    description: 'message use on the file browser',
  },
  browseImagesLabel: {
    id: 'app.presentationUploder.browseImagesLabel',
    description: 'message use on the image browser',
  },
  fileToUpload: {
    id: 'app.presentationUploder.fileToUpload',
    description: 'message used in the file selected for upload',
  },
  genericError: {
    id: 'app.presentationUploder.genericError',
    description: 'generic error while uploading/converting',
  },
  rejectedError: {
    id: 'app.presentationUploder.rejectedError',
    description: 'some files rejected, please check the file mime types',
  },
  uploadProcess: {
    id: 'app.presentationUploder.upload.progress',
    description: 'message that indicates the percentage of the upload',
  },
  413: {
    id: 'app.presentationUploder.upload.413',
    description: 'error that file exceed the size limit',
  },
  conversionProcessingSlides: {
    id: 'app.presentationUploder.conversion.conversionProcessingSlides',
    description: 'indicates how many slides were converted',
  },
  genericConversionStatus: {
    id: 'app.presentationUploder.conversion.genericConversionStatus',
    description: 'indicates that file is being converted',
  },
  TIMEOUT: {
    id: 'app.presentationUploder.conversion.timeout',
  },
  GENERATING_THUMBNAIL: {
    id: 'app.presentationUploder.conversion.generatingThumbnail',
    description: 'indicatess that it is generating thumbnails',
  },
  GENERATING_SVGIMAGES: {
    id: 'app.presentationUploder.conversion.generatingSvg',
    description: 'warns that it is generating svg images',
  },
  GENERATED_SLIDE: {
    id: 'app.presentationUploder.conversion.generatedSlides',
    description: 'warns that were slides generated',
  },
  PAGE_COUNT_EXCEEDED: {
    id: 'app.presentationUploder.conversion.pageCountExceeded',
    description: 'warns the user that the conversion failed because of the page count',
  },
  isDownloadable: {
    id: 'app.presentationUploder.isDownloadableLabel',
    description: 'presentation is available for downloading by all viewers',
  },
  isNotDownloadable: {
    id: 'app.presentationUploder.isNotDownloadableLabel',
    description: 'presentation is not available for downloading the viewers',
  },
  removePresentation: {
    id: 'app.presentationUploder.removePresentationLabel',
    description: 'select to delete this presentation',
  },
  setAsCurrentPresentation: {
    id: 'app.presentationUploder.setAsCurrentPresentation',
    description: 'set this presentation to be the current one',
  },
});

const BROWSER_RESULTS = browser();
const isMobileBrowser = (BROWSER_RESULTS ? BROWSER_RESULTS.mobile : false)
  || (BROWSER_RESULTS && BROWSER_RESULTS.os
    ? BROWSER_RESULTS.os.includes('Android') // mobile flag doesn't always work
    : false);

class PresentationUploader extends Component {
  constructor(props) {
    super(props);

    const currentPres = props.presentations.find(p => p.isCurrent);

    this.state = {
      presentations: props.presentations,
      oldCurrentId: currentPres ? currentPres.id : -1,
      preventClosing: false,
      disableActions: false,
    };

    this.handleConfirm = this.handleConfirm.bind(this);
    this.handleDismiss = this.handleDismiss.bind(this);
    this.handleFiledrop = this.handleFiledrop.bind(this);
    this.handleCurrentChange = this.handleCurrentChange.bind(this);
    this.handleRemove = this.handleRemove.bind(this);
    this.toggleDownloadable = this.toggleDownloadable.bind(this);

    this.updateFileKey = this.updateFileKey.bind(this);
    this.deepMergeUpdateFileKey = this.deepMergeUpdateFileKey.bind(this);
  }

  updateFileKey(id, key, value, operation = '$set') {
    this.setState(({ presentations }) => {
      const fileIndex = presentations.findIndex(f => f.id === id);

      return fileIndex === -1 ? false : {
        presentations: update(presentations, {
          [fileIndex]: {
            $apply: file => update(file, {
              [key]: {
                [operation]: value,
              },
            }),
          },
        }),
      };
    });
  }

  deepMergeUpdateFileKey(id, key, value) {
    const applyValue = toUpdate => update(toUpdate, { $merge: value });
    this.updateFileKey(id, key, applyValue, '$apply');
  }

  isDefault(presentation) {
    const { defaultFileName } = this.props;
    return presentation.filename === defaultFileName
      && !presentation.id.includes(defaultFileName);
  }

  handleConfirm() {
    const { mountModal, intl, handleSave } = this.props;
    const { presentations, oldCurrentId } = this.state;
    const presentationsToSave = presentations
      .filter(p => !p.upload.error && !p.conversion.error);

    this.setState({
      disableActions: true,
      preventClosing: true,
      presentations: presentationsToSave,
    });

    return handleSave(presentationsToSave)
      .then(() => {
        const hasError = presentations.some(p => p.upload.error || p.conversion.error);
        if (!hasError) {
          this.setState({
            disableActions: false,
            preventClosing: false,
          });

          mountModal(null);
          return;
        }

        // if there's error we don't want to close the modal
        this.setState({
          disableActions: false,
          preventClosing: true,
        }, () => {
          // if the selected current has error we revert back to the old one
          const newCurrent = presentations.find(p => p.isCurrent);
          if (newCurrent.upload.error || newCurrent.conversion.error) {
            this.handleCurrentChange(oldCurrentId);
          }
        });
      })
      .catch((error) => {
        notify(intl.formatMessage(intlMessages.genericError), 'error');

        logger.error({ logCode: 'presentationuploader_component_save_error' }, error);

        this.setState({
          disableActions: false,
          preventClosing: true,
        });
      });
  }

  handleDismiss() {
    const { mountModal } = this.props;

    return new Promise((resolve) => {
      mountModal(null);

      this.setState({
        preventClosing: false,
        disableActions: false,
      }, resolve);
    });
  }

  handleFiledrop(files, files2) {
    const { fileValidMimeTypes, intl } = this.props;
    const [accepted, rejected] = _.partition(files
      .concat(files2), f => fileValidMimeTypes.includes(f.type));

    const presentationsToUpload = accepted.map((file) => {
      const id = _.uniqueId(file.name);

      return {
        file,
        isDownloadable: false, // by default new presentations are set not to be downloadable
        id,
        filename: file.name,
        isCurrent: false,
        conversion: { done: false, error: false },
        upload: { done: false, error: false, progress: 0 },
        onProgress: (event) => {
          if (!event.lengthComputable) {
            this.deepMergeUpdateFileKey(id, 'upload', {
              progress: 100,
              done: true,
            });

            return;
          }

          this.deepMergeUpdateFileKey(id, 'upload', {
            progress: (event.loaded / event.total) * 100,
            done: event.loaded === event.total,
          });
        },
        onConversion: (conversion) => {
          this.deepMergeUpdateFileKey(id, 'conversion', conversion);
        },
        onUpload: (upload) => {
          this.deepMergeUpdateFileKey(id, 'upload', upload);
        },
        onDone: (newId) => {
          this.updateFileKey(id, 'id', newId);
        },
      };
    });

    this.setState(({ presentations }) => ({
      presentations: presentations.concat(presentationsToUpload),
    }), () => {
      // after the state is set (files have been dropped),
      // make the first of the new presentations current
      if (presentationsToUpload && presentationsToUpload.length) {
        this.handleCurrentChange(presentationsToUpload[0].id);
      }
    });


    if (rejected.length > 0) {
      notify(intl.formatMessage(intlMessages.rejectedError), 'error');
    }
  }

  handleCurrentChange(id) {
    const { presentations, disableActions } = this.state;
    if (disableActions) return;

    const currentIndex = presentations.findIndex(p => p.isCurrent);
    const newCurrentIndex = presentations.findIndex(p => p.id === id);

    const commands = {};

    // we can end up without a current presentation
    if (currentIndex !== -1) {
      commands[currentIndex] = {
        $apply: (presentation) => {
          const p = presentation;
          p.isCurrent = false;
          return p;
        },
      };
    }

    commands[newCurrentIndex] = {
      $apply: (presentation) => {
        const p = presentation;
        p.isCurrent = true;
        return p;
      },
    };

    const presentationsUpdated = update(presentations, commands);

    this.setState({
      presentations: presentationsUpdated,
    });
  }

  handleRemove(item) {
    const { presentations, disableActions } = this.state;
    if (disableActions) return;

    const toRemoveIndex = presentations.indexOf(item);

    this.setState({
      presentations: update(presentations, {
        $splice: [[toRemoveIndex, 1]],
      }),
    });
  }

  toggleDownloadable(item) {
    const { dispatchTogglePresentationDownloadable } = this.props;
    const { presentations } = this.state;

    const oldDownloadableState = item.isDownloadable;

    const outOfDatePresentationIndex = presentations.findIndex(p => p.id === item.id);
    const commands = {};
    commands[outOfDatePresentationIndex] = {
      $apply: (presentation) => {
        const p = presentation;
        p.isDownloadable = !oldDownloadableState;
        return p;
      },
    };
    const presentationsUpdated = update(presentations, commands);

    this.setState({
      presentations: presentationsUpdated,
    });

    // If the presentation has not be uploaded yet, adjusting the state suffices
    // otherwise set previously uploaded presentation to [not] be downloadable
    if (item.upload.done) {
      dispatchTogglePresentationDownloadable(item, !oldDownloadableState);
    }
  }

  renderPresentationList() {
    const { presentations } = this.state;

    const presentationsSorted = presentations
      .sort((a, b) => {
        // Sort by ID first so files with the same name have the same order
        if (a.id > b.id) {
          return 1;
        }
        if (a.id < b.id) {
          return -1;
        }
        return 0;
      })
      .sort((a, b) => this.isDefault(b));

    return (
      <div className={styles.fileList}>
        <table className={styles.table}>
          <tbody>
            { presentationsSorted.map(item => this.renderPresentationItem(item))}
          </tbody>
        </table>
      </div>
    );
  }

  renderPresentationItemStatus(item) {
    const { intl } = this.props;

    if (!item.upload.done && item.upload.progress === 0) {
      return intl.formatMessage(intlMessages.fileToUpload);
    }

    if (!item.upload.done && !item.upload.error) {
      return intl.formatMessage(intlMessages.uploadProcess, {
        0: Math.floor(item.upload.progress).toString(),
      });
    }

    if (item.upload.done && item.upload.error) {
      const errorMessage = intlMessages[item.upload.status] || intlMessages.genericError;
      return intl.formatMessage(errorMessage);
    }

    if (item.conversion.done && item.conversion.error) {
      const errorMessage = intlMessages[item.conversion.status] || intlMessages.genericError;
      return intl.formatMessage(errorMessage);
    }

    if (!item.conversion.done && !item.conversion.error) {
      if (item.conversion.pagesCompleted < item.conversion.numPages) {
        return intl.formatMessage(intlMessages.conversionProcessingSlides, {
          0: item.conversion.pagesCompleted,
          1: item.conversion.numPages,
        });
      }

      const conversionStatusMessage = intlMessages[item.conversion.status]
        || intlMessages.genericConversionStatus;
      return intl.formatMessage(conversionStatusMessage);
    }

    return null;
  }

  renderPresentationItem(item) {
    const { disableActions, oldCurrentId } = this.state;
    const { intl } = this.props;

    const isActualCurrent = item.id === oldCurrentId;
    const isUploading = !item.upload.done && item.upload.progress > 0;
    const isConverting = !item.conversion.done && item.upload.done;
    const hasError = item.conversion.error || item.upload.error;
    const isProcessing = (isUploading || isConverting) && !hasError;

    const itemClassName = {
      [styles.tableItemNew]: item.id.indexOf(item.filename) !== -1,
      [styles.tableItemUploading]: isUploading,
      [styles.tableItemConverting]: isConverting,
      [styles.tableItemError]: hasError,
      [styles.tableItemAnimated]: isProcessing,
    };

    const hideRemove = this.isDefault(item);
    const formattedDownloadableLabel = item.isDownloadable
      ? intl.formatMessage(intlMessages.isDownloadable)
      : intl.formatMessage(intlMessages.isNotDownloadable);

    const isDownloadableStyle = item.isDownloadable
      ? cx(styles.itemAction, styles.itemActionRemove, styles.checked)
      : cx(styles.itemAction, styles.itemActionRemove);
    return (
      <tr
        key={item.id}
        className={cx(itemClassName)}
      >
        <td className={styles.tableItemIcon}>
          <Icon iconName="file" />
        </td>
        {
          isActualCurrent
            ? (
              <th className={styles.tableItemCurrent}>
                <span className={styles.currentLabel}>
                  {intl.formatMessage(intlMessages.current)}
                </span>
              </th>
            )
            : null
        }
        <th className={styles.tableItemName} colSpan={!isActualCurrent ? 2 : 0}>
          <span>{item.filename}</span>
        </th>
        <td className={styles.tableItemStatus} colSpan={hasError ? 2 : 0}>
          {this.renderPresentationItemStatus(item)}
        </td>
        { hasError ? null : (
          <td className={styles.tableItemActions}>
            <Button
              className={isDownloadableStyle}
              label={formattedDownloadableLabel}
              hideLabel
              size="sm"
              icon={item.isDownloadable ? 'download' : 'download-off'}
              onClick={() => this.toggleDownloadable(item)}
            />
            <Checkbox
              disabled={disableActions}
              ariaLabel={intl.formatMessage(intlMessages.setAsCurrentPresentation)}
              className={styles.itemAction}
              checked={item.isCurrent}
              onChange={() => this.handleCurrentChange(item.id)}
            />
            { hideRemove ? null : (
              <Button
                disabled={disableActions}
                className={cx(styles.itemAction, styles.itemActionRemove)}
                label={intl.formatMessage(intlMessages.removePresentation)}
                size="sm"
                icon="delete"
                hideLabel
                onClick={() => this.handleRemove(item)}
              />
            )}
          </td>
        )}
      </tr>
    );
  }

  renderPicDropzone() {
    const {
      intl,
      fileSizeMin,
      fileSizeMax,
    } = this.props;

    const { disableActions } = this.state;

    if (disableActions) return null;

    return (
      <Dropzone
        multiple
        className={styles.dropzone}
        activeClassName={styles.dropzoneActive}
        rejectClassName={styles.dropzoneReject}
        accept="image/*"
        minSize={fileSizeMin}
        maxSize={fileSizeMax}
        disablePreview
        onDrop={this.handleFiledrop}
      >
        <Icon className={styles.dropzoneIcon} iconName="upload" />
        <p className={styles.dropzoneMessage}>
          {intl.formatMessage(intlMessages.dropzoneImagesLabel)}
&nbsp;
          <span className={styles.dropzoneLink}>
            {intl.formatMessage(intlMessages.browseImagesLabel)}
          </span>
        </p>
      </Dropzone>
    );
  }

  renderDropzone() {
    const {
      intl,
      fileSizeMin,
      fileSizeMax,
      fileValidMimeTypes,
    } = this.props;

    const { disableActions } = this.state;

    if (disableActions) return null;

    return (
      <Dropzone
        multiple
        className={styles.dropzone}
        activeClassName={styles.dropzoneActive}
        rejectClassName={styles.dropzoneReject}
        accept={isMobileBrowser ? '' : fileValidMimeTypes.join()}
        minSize={fileSizeMin}
        maxSize={fileSizeMax}
        disablepreview="true"
        onDrop={this.handleFiledrop}
      >
        <Icon className={styles.dropzoneIcon} iconName="upload" />
        <p className={styles.dropzoneMessage}>
          {intl.formatMessage(intlMessages.dropzoneLabel)}
&nbsp;
          <span className={styles.dropzoneLink}>
            {intl.formatMessage(intlMessages.browseFilesLabel)}
          </span>
        </p>
      </Dropzone>
    );
  }

  render() {
    const { intl } = this.props;
    const { preventClosing, disableActions } = this.state;

    return (
      <ModalFullscreen
        title={intl.formatMessage(intlMessages.title)}
        preventClosing={preventClosing}
        confirm={{
          callback: this.handleConfirm,
          label: intl.formatMessage(intlMessages.confirmLabel),
          description: intl.formatMessage(intlMessages.confirmDesc),
          disabled: disableActions,
        }}
        dismiss={{
          callback: this.handleDismiss,
          label: intl.formatMessage(intlMessages.dismissLabel),
          description: intl.formatMessage(intlMessages.dismissDesc),
          disabled: disableActions,
        }}
      >
        <p>{intl.formatMessage(intlMessages.message)}</p>
        {this.renderPresentationList()}
        <div className={styles.dropzoneWrapper}>
          {isMobileBrowser ? this.renderPicDropzone() : null}
          {this.renderDropzone()}
        </div>
      </ModalFullscreen>
    );
  }
}

PresentationUploader.propTypes = propTypes;
PresentationUploader.defaultProps = defaultProps;

export default withModalMounter(injectIntl(PresentationUploader));
