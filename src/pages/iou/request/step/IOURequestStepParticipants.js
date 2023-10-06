// TODO: This file came from MoneyRequestParticipantsPage.js and we need to be sure any recent changes are copied to this file
import React, {useRef, useCallback} from 'react';
import {View} from 'react-native';
import PropTypes from 'prop-types';
import {withOnyx} from 'react-native-onyx';
import lodashGet from 'lodash/get';
import CONST from '../../../../CONST';
import ONYXKEYS from '../../../../ONYXKEYS';
import ROUTES from '../../../../ROUTES';
import MoneyRequestParticipantsSelector from '../../steps/MoneyRequstParticipantsPage/MoneeRequestParticipantsSelector';
import styles from '../../../../styles/styles';
import ScreenWrapper from '../../../../components/ScreenWrapper';
import Navigation from '../../../../libs/Navigation/Navigation';
import * as DeviceCapabilities from '../../../../libs/DeviceCapabilities';
import HeaderWithBackButton from '../../../../components/HeaderWithBackButton';
import * as IOU from '../../../../libs/actions/IOU';
import useLocalize from '../../../../hooks/useLocalize';
import transactionPropTypes from '../../../../components/transactionPropTypes';
import * as TransactionUtils from '../../../../libs/TransactionUtils';

const propTypes = {
    /** React Navigation route */
    route: PropTypes.shape({
        /** Params from the route */
        params: PropTypes.shape({
            /** The type of IOU report, i.e. bill, request, send */
            iouType: PropTypes.string,

            /** The ID of the transaction being configured */
            transactionID: PropTypes.string,

            /** The report ID of the IOU */
            reportID: PropTypes.string,
        }),
    }).isRequired,

    /* Onyx Props */
    /** The transaction object being modified in Onyx */
    transaction: transactionPropTypes,
};

const defaultProps = {
    transaction: {},
};

function IOURequestStepParticipants({
    route: {
        params: {iouType, reportID, transactionID},
    },
    transaction,
    transaction: {participants},
}) {
    const {translate} = useLocalize();
    const optionsSelectorRef = useRef();
    const selectedReportID = useRef(reportID);
    const iouRequestType = TransactionUtils.getRequestType(transaction);
    const headerTitle = translate(TransactionUtils.getHeaderTitle(transaction));

    const addParticipant = useCallback(
        (val) => {
            IOU.setMoneeRequestParticipants(transactionID, val);

            // When a participant is selected, the reportID needs to be saved because that's the reportID that will be used in the confirmation step.
            selectedReportID.current = val[0].reportID;
        },
        [transactionID],
    );

    const goToNextStep = () => {
        Navigation.navigate(ROUTES.MONEE_REQUEST_STEP.getRoute(iouType, CONST.IOU.REQUEST_STEPS.CONFIRMATION, transactionID, selectedReportID.current), true);
    };

    const goBack = () => {
        Navigation.goBack();
    };

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight={DeviceCapabilities.canUseTouchScreen()}
            onEntryTransitionEnd={() => optionsSelectorRef.current && optionsSelectorRef.current.focus()}
            testID={IOURequestStepParticipants.displayName}
        >
            {({safeAreaPaddingBottomStyle}) => (
                <View style={styles.flex1}>
                    <HeaderWithBackButton
                        title={headerTitle}
                        onBackButtonPress={goBack}
                    />
                    <MoneyRequestParticipantsSelector
                        ref={(el) => (optionsSelectorRef.current = el)}
                        participants={participants}
                        onParticipantsAdded={addParticipant}
                        onFinish={goToNextStep}
                        safeAreaPaddingBottomStyle={safeAreaPaddingBottomStyle}
                        iouType={iouType}
                        iouRequestType={iouRequestType}
                    />
                </View>
            )}
        </ScreenWrapper>
    );
}

IOURequestStepParticipants.displayName = 'IOURequestStepParticipants';
IOURequestStepParticipants.propTypes = propTypes;
IOURequestStepParticipants.defaultProps = defaultProps;

export default withOnyx({
    transaction: {
        key: ({route}) => `${ONYXKEYS.COLLECTION.TRANSACTION}${lodashGet(route, 'params.transactionID')}`,
    },
})(IOURequestStepParticipants);