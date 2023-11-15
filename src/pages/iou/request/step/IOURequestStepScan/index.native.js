import PropTypes from 'prop-types';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, AppState, Text, View} from 'react-native';
import {RESULTS} from 'react-native-permissions';
import {useCameraDevices} from 'react-native-vision-camera';
import Hand from '@assets/images/hand.svg';
import Shutter from '@assets/images/shutter.svg';
import AttachmentPicker from '@components/AttachmentPicker';
import Button from '@components/Button';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import useLocalize from '@hooks/useLocalize';
import * as FileUtils from '@libs/fileDownload/FileUtils';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import IOURequestStepRoutePropTypes from '@pages/iou/request/step/IOURequestStepRoutePropTypes';
import reportPropTypes from '@pages/reportPropTypes';
import styles from '@styles/styles';
import themeColors from '@styles/themes/default';
import * as IOU from '@userActions/IOU';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import * as CameraPermission from './CameraPermission';
import NavigationAwareCamera from './NavigationAwareCamera';

const propTypes = {
    /** Navigation route context info provided by react navigation */
    route: IOURequestStepRoutePropTypes.isRequired,

    /** Whether or not the receipt selector is in a tab navigator for tab animations */
    // eslint-disable-next-line react/no-unused-prop-types
    isInTabNavigator: PropTypes.bool,

    /* Onyx Props */
    /** The report that the transaction belongs to */
    report: reportPropTypes,

    /** Name of the selected receipt tab */
    selectedTab: PropTypes.string,
};

const defaultProps = {
    report: {},
    isInTabNavigator: true,
    selectedTab: '',
};

function IOURequestStepScan({
    report,
    route: {
        params: {iouType, reportID, transactionID, pageIndex},
    },
    isInTabNavigator,
    selectedTab,
}) {
    const devices = useCameraDevices('wide-angle-camera');
    const device = devices.back;

    const camera = useRef(null);
    const [flash, setFlash] = useState(false);
    const [cameraPermissionStatus, setCameraPermissionStatus] = useState(undefined);

    const {translate} = useLocalize();

    useEffect(() => {
        const refreshCameraPermissionStatus = () => {
            CameraPermission.getCameraPermissionStatus()
                .then(setCameraPermissionStatus)
                .catch(() => setCameraPermissionStatus(RESULTS.UNAVAILABLE));
        };

        // Check initial camera permission status
        refreshCameraPermissionStatus();

        // Refresh permission status when app gain focus
        const subscription = AppState.addEventListener('change', (appState) => {
            if (appState !== 'active') {
                return;
            }

            refreshCameraPermissionStatus();
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const askForPermissions = () => {
        // There's no way we can check for the BLOCKED status without requesting the permission first
        // https://github.com/zoontek/react-native-permissions/blob/a836e114ce3a180b2b23916292c79841a267d828/README.md?plain=1#L670
        CameraPermission.requestCameraPermission()
            .then((status) => {
                setCameraPermissionStatus(status);

                if (status === RESULTS.BLOCKED) {
                    FileUtils.showCameraPermissionsAlert();
                }
            })
            .catch(() => {
                setCameraPermissionStatus(RESULTS.UNAVAILABLE);
            });
    };

    const takePhoto = useCallback(() => {
        const showCameraAlert = () => {
            Alert.alert(translate('receipt.cameraErrorTitle'), translate('receipt.cameraErrorMessage'));
        };

        if (!camera.current) {
            showCameraAlert();
            return;
        }

        camera.current
            .takePhoto({
                qualityPrioritization: 'speed',
                flash: flash ? 'on' : 'off',
            })
            .then((photo) => {
                const filePath = `file://${photo.path}`;
                IOU.setMoneyRequestReceipt_temporaryForRefactor(transactionID, filePath, photo.path);

                // When an existing transaction is being edited (eg. not the create transaction flow)
                if (transactionID !== CONST.IOU.OPTIMISTIC_TRANSACTION_ID) {
                    FileUtils.readFileAsync(filePath, photo.path).then((receipt) => {
                        IOU.replaceReceipt(transactionID, receipt, filePath);
                    });

                    Navigation.dismissModal();
                    return;
                }

                // If a reportID exists in the report object, it's because the user started this flow from using the + button in the composer
                // inside a report. In this case, the participants can be automatically assigned from the report and the user can skip the participants step and go straight
                // to the confirm step.
                if (report.reportID) {
                    IOU.setMoneyRequestParticipantsFromReport(transactionID, report);
                    Navigation.navigate(ROUTES.MONEYTEMPORARYFORREFACTOR_REQUEST_STEP_CONFIRMATION.getRoute(iouType, transactionID, reportID));
                    return;
                }

                Navigation.navigate(ROUTES.MONEYTEMPORARYFORREFACTOR_REQUEST_STEP_PARTICIPANTS.getRoute(iouType, transactionID, reportID));
            })
            .catch((error) => {
                showCameraAlert();
                Log.warn('Error taking photo', error);
            });
    }, [flash, iouType, report, translate, transactionID, reportID]);

    // Wait for camera permission status to render
    if (cameraPermissionStatus == null) {
        return null;
    }

    return (
        <View style={styles.flex1}>
            {cameraPermissionStatus !== RESULTS.GRANTED && (
                <View style={[styles.cameraView, styles.permissionView, styles.userSelectNone]}>
                    <Hand
                        width={CONST.RECEIPT.HAND_ICON_WIDTH}
                        height={CONST.RECEIPT.HAND_ICON_HEIGHT}
                        style={[styles.pb5]}
                    />
                    <Text style={[styles.textReceiptUpload]}>{translate('receipt.takePhoto')}</Text>
                    <Text style={[styles.subTextReceiptUpload]}>{translate('receipt.cameraAccess')}</Text>
                    <Button
                        medium
                        success
                        text={translate('common.continue')}
                        accessibilityLabel={translate('common.continue')}
                        style={[styles.p9, styles.pt5]}
                        onPress={askForPermissions}
                    />
                </View>
            )}
            {cameraPermissionStatus === RESULTS.GRANTED && device == null && (
                <View style={[styles.cameraView]}>
                    <ActivityIndicator
                        size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE}
                        style={[styles.flex1]}
                        color={themeColors.textSupporting}
                    />
                </View>
            )}
            {cameraPermissionStatus === RESULTS.GRANTED && device != null && (
                <NavigationAwareCamera
                    ref={camera}
                    device={device}
                    style={[styles.cameraView]}
                    zoom={device.neutralZoom}
                    photo
                    cameraTabIndex={pageIndex}
                    isInTabNavigator={isInTabNavigator}
                    selectedTab={selectedTab}
                />
            )}
            <View style={[styles.flexRow, styles.justifyContentAround, styles.alignItemsCenter, styles.pv3]}>
                <AttachmentPicker shouldHideCameraOption>
                    {({openPicker}) => (
                        <PressableWithFeedback
                            accessibilityRole={CONST.ACCESSIBILITY_ROLE.BUTTON}
                            accessibilityLabel={translate('receipt.gallery')}
                            style={[styles.alignItemsStart]}
                            onPress={() => {
                                openPicker({
                                    onPicked: (file) => {
                                        const filePath = file.uri;
                                        IOU.setMoneyRequestReceipt_temporaryForRefactor(transactionID, filePath, file.name);

                                        // When a transaction is being edited (eg. not in the creation flow)
                                        if (transactionID !== CONST.IOU.OPTIMISTIC_TRANSACTION_ID) {
                                            IOU.replaceReceipt(transactionID, file, filePath);
                                            Navigation.dismissModal();
                                            return;
                                        }

                                        // If a reportID exists in the report object, it's because the user started this flow from using the + button in the composer
                                        // inside a report. In this case, the participants can be automatically assigned from the report and the user can skip the participants step and go straight
                                        // to the confirm step.
                                        if (report.reportID) {
                                            IOU.setMoneyRequestParticipantsFromReport(transactionID, report);
                                            Navigation.navigate(ROUTES.MONEYTEMPORARYFORREFACTOR_REQUEST_STEP_CONFIRMATION.getRoute(iouType, transactionID, reportID));
                                            return;
                                        }

                                        Navigation.navigate(ROUTES.MONEYTEMPORARYFORREFACTOR_REQUEST_STEP_PARTICIPANTS.getRoute(iouType, transactionID, reportID));
                                    },
                                });
                            }}
                        >
                            <Icon
                                height={32}
                                width={32}
                                src={Expensicons.Gallery}
                                fill={themeColors.textSupporting}
                            />
                        </PressableWithFeedback>
                    )}
                </AttachmentPicker>
                <PressableWithFeedback
                    accessibilityRole={CONST.ACCESSIBILITY_ROLE.BUTTON}
                    accessibilityLabel={translate('receipt.shutter')}
                    style={[styles.alignItemsCenter]}
                    onPress={takePhoto}
                >
                    <Shutter
                        width={CONST.RECEIPT.SHUTTER_SIZE}
                        height={CONST.RECEIPT.SHUTTER_SIZE}
                    />
                </PressableWithFeedback>
                <PressableWithFeedback
                    accessibilityRole={CONST.ACCESSIBILITY_ROLE.BUTTON}
                    accessibilityLabel={translate('receipt.flash')}
                    style={[styles.alignItemsEnd]}
                    disabled={cameraPermissionStatus !== RESULTS.GRANTED}
                    onPress={() => setFlash((prevFlash) => !prevFlash)}
                >
                    <Icon
                        height={32}
                        width={32}
                        src={Expensicons.Bolt}
                        fill={flash ? themeColors.iconHovered : themeColors.textSupporting}
                    />
                </PressableWithFeedback>
            </View>
        </View>
    );
}

IOURequestStepScan.defaultProps = defaultProps;
IOURequestStepScan.propTypes = propTypes;
IOURequestStepScan.displayName = 'IOURequestStepScan';

export default IOURequestStepScan;