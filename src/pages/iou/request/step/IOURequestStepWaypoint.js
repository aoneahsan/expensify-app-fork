import {useNavigation} from '@react-navigation/native';
import lodashGet from 'lodash/get';
import PropTypes from 'prop-types';
import React, {useMemo, useRef, useState} from 'react';
import {InteractionManager, View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import _ from 'underscore';

import AddressSearch from '../../../../components/AddressSearch';
import FullPageNotFoundView from '../../../../components/BlockingViews/FullPageNotFoundView';
import ConfirmModal from '../../../../components/ConfirmModal';
import Form from '../../../../components/Form';
import HeaderWithBackButton from '../../../../components/HeaderWithBackButton';
import * as Expensicons from '../../../../components/Icon/Expensicons';
import ScreenWrapper from '../../../../components/ScreenWrapper';
import transactionPropTypes from '../../../../components/transactionPropTypes';
import CONST from '../../../../CONST';
import useLocalize from '../../../../hooks/useLocalize';
import useNetwork from '../../../../hooks/useNetwork';
import useWindowDimensions from '../../../../hooks/useWindowDimensions';
import * as Transaction from '../../../../libs/actions/Transaction';
import * as ErrorUtils from '../../../../libs/ErrorUtils';
import Navigation from '../../../../libs/Navigation/Navigation';
import * as ValidationUtils from '../../../../libs/ValidationUtils';
import ONYXKEYS from '../../../../ONYXKEYS';
import ROUTES from '../../../../ROUTES';
import styles from '../../../../styles/styles';

const propTypes = {
    /** Route params */
    route: PropTypes.shape({
        params: PropTypes.shape({
            /** IOU type */
            iouType: PropTypes.string,

            /** Thread reportID */
            reportID: PropTypes.string,

            /** ID of the transaction being edited */
            transactionID: PropTypes.string,

            /** Index of the waypoint being edited */
            waypointIndex: PropTypes.string,
        }),
    }),

    /* Onyx props */
    /** The optimistic transaction for this request */
    transaction: transactionPropTypes,

    /** Recent waypoints that the user has selected */
    recentWaypoints: PropTypes.arrayOf(
        PropTypes.shape({
            /** A description of the location (usually the address) */
            description: PropTypes.string,

            /** Data required by the google auto complete plugin to know where to put the markers on the map */
            geometry: PropTypes.shape({
                /** Data about the location */
                location: PropTypes.shape({
                    /** Lattitude of the location */
                    lat: PropTypes.number,

                    /** Longitude of the location */
                    lng: PropTypes.number,
                }),
            }),
        }),
    ),
};

const defaultProps = {
    route: {},
    recentWaypoints: [],
    transaction: {},
};

function IOURequestStepWaypoint({route: {params: {iouType = '', transactionID = '', waypointIndex = '', reportID = ''}} = {}, transaction, recentWaypoints}) {
    const {windowWidth} = useWindowDimensions();
    const [isDeleteStopModalOpen, setIsDeleteStopModalOpen] = useState(false);
    const navigation = useNavigation();
    const isFocused = navigation.isFocused();
    const {translate} = useLocalize();
    const {isOffline} = useNetwork();
    const textInput = useRef(null);
    const parsedWaypointIndex = parseInt(waypointIndex, 10);
    const allWaypoints = lodashGet(transaction, 'comment.waypoints', {});
    const waypointCount = _.keys(allWaypoints).length;
    const currentWaypoint = lodashGet(allWaypoints, `waypoint${waypointIndex}`, {});

    const wayPointDescriptionKey = useMemo(() => {
        switch (parsedWaypointIndex) {
            case 0:
                return 'distance.waypointDescription.start';
            case waypointCount - 1:
                return 'distance.waypointDescription.finish';
            default:
                return 'distance.waypointDescription.stop';
        }
    }, [parsedWaypointIndex, waypointCount]);

    const waypointAddress = lodashGet(currentWaypoint, 'address', '');
    const totalWaypoints = _.size(lodashGet(transaction, 'comment.waypoints', {}));
    // Hide the menu when there is only start and finish waypoint
    const shouldShowThreeDotsButton = totalWaypoints > 2;

    const validate = (values) => {
        const errors = {};
        const waypointValue = values[`waypoint${waypointIndex}`] || '';
        if (isOffline && waypointValue !== '' && !ValidationUtils.isValidAddress(waypointValue)) {
            ErrorUtils.addErrorMessage(errors, `waypoint${waypointIndex}`, 'bankAccount.error.address');
        }

        // If the user is online and they are trying to save a value without using the autocomplete, show an error message instructing them to use a selected address instead.
        // That enables us to save the address with coordinates when it is selected
        if (!isOffline && waypointValue !== '' && waypointAddress !== waypointValue) {
            ErrorUtils.addErrorMessage(errors, `waypoint${waypointIndex}`, 'distance.errors.selectSuggestedAddress');
        }

        return errors;
    };

    const saveWaypoint = (waypoint) => {
        if (parsedWaypointIndex < _.size(allWaypoints)) {
            Transaction.saveWaypoint(transactionID, waypointIndex, waypoint);
        } else {
            const finishWaypoint = lodashGet(allWaypoints, `waypoint${_.size(allWaypoints) - 1}`, {});
            Transaction.saveWaypoint(transactionID, waypointIndex, finishWaypoint);
            Transaction.saveWaypoint(transactionID, waypointIndex - 1, waypoint);
        }
    };

    const submit = (values) => {
        const waypointValue = values[`waypoint${waypointIndex}`] || '';

        // Allows letting you set a waypoint to an empty value
        if (waypointValue === '') {
            Transaction.removeWaypoint(transactionID, waypointIndex);
        }

        // While the user is offline, the auto-complete address search will not work
        // Therefore, we're going to save the waypoint as just the address, and the lat/long will be filled in on the backend
        if (isOffline && waypointValue) {
            const waypoint = {
                lat: null,
                lng: null,
                address: waypointValue,
            };
            saveWaypoint(waypoint);
        }

        // Other flows will be handled by selecting a waypoint with selectWaypoint as this is mainly for the offline flow
        Navigation.goBack(ROUTES.MONEY_REQUEST_DISTANCE_TAB.getRoute(iouType));
    };

    const deleteStopAndHideModal = () => {
        Transaction.removeWaypoint(transactionID, waypointIndex);
        setIsDeleteStopModalOpen(false);
        Navigation.goBack(ROUTES.MONEY_REQUEST_DISTANCE_TAB.getRoute(iouType));
    };

    /**
     * @param {Object} values
     * @param {String} values.lat
     * @param {String} values.lng
     * @param {String} values.address
     */
    const selectWaypoint = (values) => {
        const waypoint = {
            lat: values.lat,
            lng: values.lng,
            address: values.address,
        };
        Transaction.saveWaypoint(transactionID, waypointIndex, waypoint, false);
        Navigation.goBack(ROUTES.MONEE_REQUEST_CREATE_TAB_DISTANCE.getRoute(iouType, transactionID, reportID));
    };

    const focusAddressInput = () => {
        InteractionManager.runAfterInteractions(() => {
            if (!textInput.current) {
                return;
            }
            textInput.current.focus();
        });
    };

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            onEntryTransitionEnd={() => textInput.current && textInput.current.focus()}
            shouldEnableMaxHeight
            testID={IOURequestStepWaypoint.displayName}
        >
            <FullPageNotFoundView shouldShow={(Number.isNaN(parsedWaypointIndex) || parsedWaypointIndex < 0 || parsedWaypointIndex > waypointCount) && isFocused}>
                <HeaderWithBackButton
                    title={translate(wayPointDescriptionKey)}
                    shouldShowBackButton
                    onBackButtonPress={() => {
                        Navigation.goBack(ROUTES.MONEY_REQUEST_DISTANCE_TAB.getRoute(iouType));
                    }}
                    shouldShowThreeDotsButton={shouldShowThreeDotsButton}
                    threeDotsAnchorPosition={styles.threeDotsPopoverOffset(windowWidth)}
                    threeDotsMenuItems={[
                        {
                            icon: Expensicons.Trashcan,
                            text: translate('distance.deleteWaypoint'),
                            onSelected: () => setIsDeleteStopModalOpen(true),
                        },
                    ]}
                    onModalHide={focusAddressInput}
                />
                <ConfirmModal
                    title={translate('distance.deleteWaypoint')}
                    isVisible={isDeleteStopModalOpen}
                    onConfirm={deleteStopAndHideModal}
                    onCancel={() => setIsDeleteStopModalOpen(false)}
                    onModalHide={focusAddressInput}
                    prompt={translate('distance.deleteWaypointConfirmation')}
                    confirmText={translate('common.delete')}
                    cancelText={translate('common.cancel')}
                    danger
                />
                <Form
                    style={[styles.flexGrow1, styles.mh5]}
                    formID={ONYXKEYS.FORMS.WAYPOINT_FORM}
                    enabledWhenOffline
                    validate={validate}
                    onSubmit={submit}
                    shouldValidateOnChange={false}
                    shouldValidateOnBlur={false}
                    submitButtonText={translate('common.save')}
                >
                    <View>
                        <AddressSearch
                            inputID={`waypoint${waypointIndex}`}
                            ref={(e) => (textInput.current = e)}
                            hint={!isOffline ? 'distance.errors.selectSuggestedAddress' : ''}
                            containerStyles={[styles.mt4]}
                            label={translate('distance.address')}
                            defaultValue={waypointAddress}
                            onPress={selectWaypoint}
                            maxInputLength={CONST.FORM_CHARACTER_LIMIT}
                            renamedInputKeys={{
                                address: `waypoint${waypointIndex}`,
                                city: null,
                                country: null,
                                street: null,
                                street2: null,
                                zipCode: null,
                                lat: null,
                                lng: null,
                                state: null,
                            }}
                            predefinedPlaces={recentWaypoints}
                            resultTypes=""
                        />
                    </View>
                </Form>
            </FullPageNotFoundView>
        </ScreenWrapper>
    );
}

IOURequestStepWaypoint.displayName = 'IOURequestStepWaypoint';
IOURequestStepWaypoint.propTypes = propTypes;
IOURequestStepWaypoint.defaultProps = defaultProps;
export default withOnyx({
    transaction: {
        key: ({route}) => `${ONYXKEYS.COLLECTION.TRANSACTION}${lodashGet(route, 'params.transactionID')}`,
    },
    recentWaypoints: {
        key: ONYXKEYS.NVP_RECENT_WAYPOINTS,

        // Only grab the most recent 5 waypoints because that's all that is shown in the UI. This also puts them into the format of data
        // that the google autocomplete component expects for it's "predefined places" feature.
        selector: (waypoints) =>
            _.map(waypoints ? waypoints.slice(0, 5) : [], (waypoint) => ({
                description: waypoint.address,
                geometry: {
                    location: {
                        lat: waypoint.lat,
                        lng: waypoint.lng,
                    },
                },
            })),
    },
})(IOURequestStepWaypoint);