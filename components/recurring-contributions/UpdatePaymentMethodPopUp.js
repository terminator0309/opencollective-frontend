import React, { Fragment, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation, useQuery } from '@apollo/client';
import { Lock } from '@styled-icons/boxicons-regular/Lock';
import themeGet from '@styled-system/theme-get';
import { first, get, pick, uniqBy } from 'lodash';
import { withRouter } from 'next/router';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import styled from 'styled-components';

import { getErrorFromGraphqlException } from '../../lib/errors';
import { API_V2_CONTEXT, gqlV2 } from '../../lib/graphql/helpers';
import { getPaymentMethodName } from '../../lib/payment_method_label';
import { getPaymentMethodIcon, getPaymentMethodMetadata } from '../../lib/payment-method-utils';
import { getStripe, stripeTokenToPaymentMethod } from '../../lib/stripe';

import { Box, Flex } from '../Grid';
import LoadingPlaceholder from '../LoadingPlaceholder';
import NewCreditCardForm from '../NewCreditCardForm';
import { withStripeLoader } from '../StripeProvider';
import StyledButton from '../StyledButton';
import StyledHr from '../StyledHr';
import StyledRadioList from '../StyledRadioList';
import StyledRoundButton from '../StyledRoundButton';
import { P } from '../Text';
import ErrorPage from '../ErrorPage';

const PaymentMethodBox = styled(Flex)`
  border-top: 1px solid ${themeGet('colors.black.300')};
`;

const messages = defineMessages({
  updatePaymentMethod: {
    id: 'subscription.menu.editPaymentMethod',
    defaultMessage: 'Update payment method',
  },
  addPaymentMethod: {
    id: 'subscription.menu.addPaymentMethod',
    defaultMessage: 'Add new payment method',
  },
});

const paymentMethodsQuery = gqlV2/* GraphQL */ `
  query UpdatePaymentMethodPopUpPaymentMethod($slug: String) {
    account(slug: $slug) {
      id
      paymentMethods(types: ["creditcard", "virtualcard", "prepaid"]) {
        id
        name
        data
        service
        type
        balance {
          value
          currency
        }
        account {
          id
        }
      }
    }
  }
`;

const updatePaymentMethodMutation = gqlV2/* GraphQL */ `
  mutation UpdatePaymentMethod($order: OrderReferenceInput!, $paymentMethod: PaymentMethodReferenceInput!) {
    updateOrder(order: $order, paymentMethod: $paymentMethod) {
      id
      status
      paymentMethod {
        id
      }
    }
  }
`;

const paymentMethodResponseFragment = gqlV2/* GraphQL */ `
  fragment paymentMethodResponseFragment on PaymentMethodWithStripeError {
    paymentMethod {
      id
      name
    }
    stripeError {
      message
      response
    }
  }
`;

const addPaymentMethodMutation = gqlV2/* GraphQL */ `
  mutation AddPaymentMethod($paymentMethod: PaymentMethodCreateInput!, $account: AccountReferenceInput!) {
    addCreditCard(paymentMethod: $paymentMethod, account: $account) {
      ...paymentMethodResponseFragment
    }
  }
  ${paymentMethodResponseFragment}
`;

const mutationOptions = { context: API_V2_CONTEXT };

const UpdatePaymentMethodPopUp = ({
  setMenuState,
  contribution,
  createNotification,
  setShowPopup,
  router,
  loadStripe,
  account,
}) => {
  const intl = useIntl();

  // state management
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [loadingSelectedPaymentMethod, setLoadingSelectedPaymentMethod] = useState(true);
  const [stripeIsReady, setStripeIsReady] = useState(false);
  const [stripe, setStripe] = useState(null);
  const [newPaymentMethodInfo, setNewPaymentMethodInfo] = useState(null);
  const [addedPaymentMethod, setAddedPaymentMethod] = useState(null);

  // GraphQL mutations and queries
  const { data, refetch } = useQuery(paymentMethodsQuery, {
    variables: {
      slug: router.query.slug,
    },
    context: API_V2_CONTEXT,
  });
  const [submitUpdatePaymentMethod, { loading: loadingUpdatePaymentMethod }] = useMutation(
    updatePaymentMethodMutation,
    mutationOptions,
  );
  const [submitAddPaymentMethod, { loading: loadingAddPaymentMethod }] = useMutation(
    addPaymentMethodMutation,
    mutationOptions,
  );

  // load stripe on mount
  useEffect(() => {
    loadStripe();
    setStripeIsReady(true);
  }, [stripeIsReady]);

  // data handling
  const minBalance = 50; // Minimum usable balance for virtual card

  const paymentMethods = get(data, 'account.paymentMethods', null);
  const paymentOptions = React.useMemo(() => {
    if (!paymentMethods) {
      return null;
    }
    const paymentMethodsOptions = paymentMethods.map(pm => ({
      key: `${contribution.id}-pm-${pm.id}`,
      title: getPaymentMethodName(pm),
      subtitle: getPaymentMethodMetadata(pm),
      icon: getPaymentMethodIcon(pm),
      paymentMethod: pm,
      disabled: pm.balance.amount < minBalance,
      id: pm.id,
      CollectiveId: pm.account.id,
    }));
    const uniquePMs = uniqBy(paymentMethodsOptions, 'id');
    // put the PM that matches this recurring contribution on top of the list
    let sortedPMs = uniquePMs.sort(a => a.id !== contribution.paymentMethod?.id);
    // if we've just added a PM, put it at the top of the list
    if (addedPaymentMethod !== null) {
      sortedPMs = sortedPMs.sort(a => a.id !== addedPaymentMethod.id);
    }
    console.log('sorted pms', sortedPMs);
    return sortedPMs;
  }, [paymentMethods]);

  useEffect(() => {
    console.log('using effect');
    if (paymentOptions && selectedPaymentMethod === null && contribution.paymentMethod) {
      setSelectedPaymentMethod(first(paymentOptions.filter(option => option.id === contribution.paymentMethod.id)));
      setLoadingSelectedPaymentMethod(false);
    } else if (paymentOptions && addedPaymentMethod) {
      console.log('new payment method added');
      console.log(addedPaymentMethod);
      setSelectedPaymentMethod(paymentOptions.find(option => option.id === addedPaymentMethod.id));
      setLoadingSelectedPaymentMethod(false);
    }
  }, [paymentOptions, addedPaymentMethod]);

  return (
    <Fragment>
      <Flex width={1} alignItems="center" justifyContent="center" minHeight={50} px={3}>
        <P my={2} fontSize="12px" textTransform="uppercase" color="black.700">
          {showAddPaymentMethod
            ? intl.formatMessage(messages.addPaymentMethod)
            : intl.formatMessage(messages.updatePaymentMethod)}
        </P>
        <Flex flexGrow={1} alignItems="center">
          <StyledHr width="100%" mx={2} />
        </Flex>
        {showAddPaymentMethod ? (
          <Lock size={20} />
        ) : (
          <StyledRoundButton
            size={24}
            onClick={() => setShowAddPaymentMethod(true)}
            data-cy="recurring-contribution-add-pm-button"
          >
            +
          </StyledRoundButton>
        )}
      </Flex>
      {showAddPaymentMethod ? (
        <Box px={1} pt={2} pb={3}>
          <NewCreditCardForm
            name="newCreditCardInfo"
            profileType={'USER'}
            onChange={setNewPaymentMethodInfo}
            onReady={({ stripe }) => setStripe(stripe)}
            hasSaveCheckBox={false}
          />
        </Box>
      ) : loadingSelectedPaymentMethod ? (
        <LoadingPlaceholder height={100} />
      ) : (
        <StyledRadioList
          id="PaymentMethod"
          name={`${contribution.id}-PaymentMethod`}
          keyGetter="key"
          options={paymentOptions}
          onChange={setSelectedPaymentMethod}
          value={selectedPaymentMethod?.key}
        >
          {({ radio, value: { title, subtitle, icon } }) => (
            <PaymentMethodBox minheight={50} py={2} bg="white.full" data-cy="recurring-contribution-pm-box" px={3}>
              <Flex alignItems="center">
                <Box as="span" mr={3} flexWrap="wrap">
                  {radio}
                </Box>
                <Flex mr={2} css={{ flexBasis: '26px' }}>
                  {icon}
                </Flex>
                <Flex flexDirection="column">
                  <P fontSize="12px" fontWeight={subtitle ? 600 : 400} color="black.900">
                    {title}
                  </P>
                  {subtitle && (
                    <P fontSize="12px" fontWeight={400} lineHeight="18px" color="black.500">
                      {subtitle}
                    </P>
                  )}
                </Flex>
              </Flex>
            </PaymentMethodBox>
          )}
        </StyledRadioList>
      )}
      <Flex flexGrow={1 / 4} width={1} alignItems="center" justifyContent="center">
        <Flex flexGrow={1} alignItems="center">
          <StyledHr width="100%" />
        </Flex>
      </Flex>
      <Flex flexGrow={1 / 4} width={1} alignItems="center" justifyContent="center" minHeight={50}>
        {showAddPaymentMethod ? (
          <Fragment>
            <StyledButton
              buttonSize="tiny"
              minWidth={75}
              onClick={() => {
                setShowAddPaymentMethod(false);
                setNewPaymentMethodInfo(null);
              }}
            >
              <FormattedMessage id="actions.cancel" defaultMessage="Cancel" />
            </StyledButton>
            <StyledButton
              ml={2}
              minWidth={75}
              buttonSize="tiny"
              buttonStyle="secondary"
              disabled={newPaymentMethodInfo ? !newPaymentMethodInfo?.value.complete : true}
              type="submit"
              loading={loadingAddPaymentMethod}
              data-cy="recurring-contribution-submit-pm-button"
              onClick={async () => {
                if (!stripe) {
                  createNotification(
                    'error',
                    'There was a problem initializing the payment form. Please reload the page and try again',
                  );
                  return false;
                }
                const { token, error } = await stripe.createToken();

                if (error) {
                  createNotification('error', error.message);
                  return false;
                }
                const newStripePaymentMethod = stripeTokenToPaymentMethod(token);
                const newPaymentMethod = pick(newStripePaymentMethod, ['name', 'token', 'data']);
                try {
                  const res = await submitAddPaymentMethod({
                    variables: { paymentMethod: newPaymentMethod, account: { id: account.id } },
                    // refetchQueries: [
                    //   {
                    //     query: paymentMethodsQuery,
                    //     variables: { slug: router.query.slug },
                    //     context: API_V2_CONTEXT,
                    //   },
                    // ],
                  });
                  console.log('res', res.data.addCreditCard);
                  if (res.data.addCreditCard.stripeError) {
                    const stripe = await getStripe();
                    const result = await stripe.handleCardSetup(
                      res.data.addCreditCard.stripeError.response.setupIntent.client_secret,
                    );
                    console.log('result', result);
                    if (result.error) {
                      createNotification('error', result.error.message);
                      return false;
                    }
                  }
                  console.log('set up fine');
                  refetch();
                  setAddedPaymentMethod(res.data.addCreditCard.paymentMethod);
                  setShowAddPaymentMethod(false);
                  setLoadingSelectedPaymentMethod(true);
                } catch (error) {
                  const errorMsg = getErrorFromGraphqlException(error).message;
                  createNotification('error', errorMsg);
                  return false;
                }
              }}
            >
              <FormattedMessage id="save" defaultMessage="Save" />
            </StyledButton>
          </Fragment>
        ) : (
          <Fragment>
            <StyledButton
              buttonSize="tiny"
              minWidth={75}
              onClick={() => {
                setMenuState('mainMenu');
              }}
            >
              <FormattedMessage id="actions.cancel" defaultMessage="Cancel" />
            </StyledButton>
            <StyledButton
              ml={2}
              minWidth={75}
              buttonSize="tiny"
              buttonStyle="secondary"
              loading={loadingUpdatePaymentMethod}
              data-cy="recurring-contribution-update-pm-button"
              onClick={async () => {
                try {
                  await submitUpdatePaymentMethod({
                    variables: {
                      order: { id: contribution.id },
                      paymentMethod: {
                        id: selectedPaymentMethod.value ? selectedPaymentMethod.value.id : selectedPaymentMethod.id,
                      },
                    },
                  });
                  createNotification('update');
                  setShowPopup(false);
                } catch (error) {
                  const errorMsg = getErrorFromGraphqlException(error).message;
                  createNotification('error', errorMsg);
                  return false;
                }
              }}
            >
              <FormattedMessage id="subscription.updateAmount.update.btn" defaultMessage="Update" />
            </StyledButton>
          </Fragment>
        )}
      </Flex>
    </Fragment>
  );
};

UpdatePaymentMethodPopUp.propTypes = {
  data: PropTypes.object,
  setMenuState: PropTypes.func,
  router: PropTypes.object.isRequired,
  contribution: PropTypes.object.isRequired,
  createNotification: PropTypes.func,
  setShowPopup: PropTypes.func,
  loadStripe: PropTypes.func.isRequired,
  account: PropTypes.object.isRequired,
};

export default withStripeLoader(withRouter(UpdatePaymentMethodPopUp));
