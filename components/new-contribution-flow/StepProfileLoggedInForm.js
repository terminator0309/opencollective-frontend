import React, { Fragment, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Field, Form, Formik } from 'formik';
import { orderBy, pick, trim } from 'lodash';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import slugify from 'slugify';

import { reportValidityHTML5 } from '../../lib/utils';

import Avatar from '../../components/Avatar';
import Container from '../../components/Container';
import { Box, Flex } from '../../components/Grid';
import StyledInput from '../../components/StyledInput';
import StyledInputField from '../../components/StyledInputField';
import StyledInputGroup from '../../components/StyledInputGroup';
import StyledRadioList from '../../components/StyledRadioList';
import { P } from '../../components/Text';

const msg = defineMessages({
  incognito: {
    id: 'profile.incognito',
    defaultMessage: 'Incognito',
  },
  'org.new': { id: 'contributeAs.org.new', defaultMessage: 'A new organization' },
  'org.name': { id: 'contributeAs.org.name', defaultMessage: 'Organization Name' },
  'org.website': { id: 'Fields.website', defaultMessage: 'Website' },
  'org.twitter': { id: 'contributeAs.org.twitter', defaultMessage: 'Twitter (optional)' },
  'org.slug': { id: 'contributeAs.org.slug', defaultMessage: 'What URL would you like?' },
  suggestedLabel: { id: 'createCollective.form.suggestedLabel', defaultMessage: 'Suggested' },
  errorName: {
    id: 'createCollective.form.error.name',
    defaultMessage: 'Please use fewer than 50 characters',
  },
  errorTwitter: {
    id: 'onboarding.error.twitter',
    defaultMessage: 'Please enter a valid Twitter handle.',
  },
  errorSlug: {
    id: 'createCollective.form.error.slug',
    defaultMessage: 'Please use fewer than 30 characters',
  },
  errorSlugHyphen: {
    id: 'createCollective.form.error.slug.hyphen',
    defaultMessage: 'Collective slug can not start nor end with hyphen',
  },
});

const prepareProfiles = (intl, profiles, collective, canUseIncognito) => {
  const filteredProfiles = profiles.filter(p => {
    // if admin of collective you are donating to, remove it from the list
    if (p.id === collective.legacyId) {
      return false;
    } else if (!canUseIncognito && p.isIncognito) {
      return false;
    } else if (p.type === 'COLLECTIVE' && (!p.host || p.host.id !== collective.host?.legacyId)) {
      return false;
    } else {
      return true;
    }
  });

  if (canUseIncognito) {
    const incognitoProfile = filteredProfiles.find(p => p.type === 'USER' && p.isIncognito);
    if (!incognitoProfile) {
      filteredProfiles.push({
        id: 'incognito',
        type: 'USER',
        isIncognito: true,
        name: intl.formatMessage(msg.incognito), // has to be a string for avatar's title
        isNewProfile: true,
      });
    }
  }

  filteredProfiles.push({
    id: 'org.new',
    type: 'ORGANIZATION',
    name: intl.formatMessage(msg['org.new']),
    isNewOrg: true,
    isNewProfile: true,
  });

  // Will put first: User / Not incognito
  return orderBy(filteredProfiles, ['isNewOrg', 'type', 'isIncognito', 'name'], ['desc', 'desc', 'desc', 'asc']);
};

const NewContributionFlowStepProfileLoggedInForm = ({
  profiles,
  defaultSelectedProfile,
  onChange,
  canUseIncognito,
  collective,
}) => {
  const intl = useIntl();
  const formRef = useRef();

  // set initial default profile so it shows in Steps Progress as well
  useEffect(() => {
    onChange({ stepProfile: defaultSelectedProfile, stepPayment: null, stepSummary: null });
  }, [defaultSelectedProfile]);

  const filteredProfiles = React.useMemo(() => prepareProfiles(intl, profiles, collective, canUseIncognito), [
    profiles,
    collective,
    canUseIncognito,
  ]);

  // Formik
  const initialValues = {
    name: '',
    slug: '',
    website: '',
    twitterHandle: '',
  };

  const validate = values => {
    const errors = {};

    if (values.name.length > 5) {
      errors.name = intl.formatMessage(msg.errorName);
    }

    if (values.slug.length > 30) {
      errors.slug = intl.formatMessage(msg.errorSlug);
    }
    if (values.slug !== trim(values.slug, '-')) {
      errors.slug = intl.formatMessage(msg.errorSlugHyphen);
    }

    if (values.twitterHandle.length > 15) {
      errors.twitterHandle = intl.formatMessage(msg.errorTwitter);
    }

    return errors;
  };

  return (
    <Fragment>
      <Box px={3}>
        <StyledRadioList
          name="ContributionProfile"
          id="ContributionProfile"
          options={filteredProfiles}
          keyGetter="id"
          defaultValue={defaultSelectedProfile ? defaultSelectedProfile.id : undefined}
          radioSize={16}
          onChange={selected => {
            if (!selected.value.isNewOrg) {
              onChange({ stepProfile: selected.value });
            } else {
              onChange({ stepProfile: { isNewOrg: true } });
            }
          }}
        >
          {({ radio, value, key, checked }) => (
            <Box minHeight={70} py={2} bg="white.full" px={[0, 3]}>
              <Flex alignItems="center" flexWrap="wrap" width={1}>
                <Box as="span" mr={3} flexWrap="wrap">
                  {radio}
                </Box>
                <Flex mr={3} css={{ flexBasis: '26px' }}>
                  <Avatar collective={value} size="3.6rem" />
                </Flex>
                <Flex flexDirection="column" flexGrow={1} maxWidth="75%">
                  <P fontSize="14px" lineHeight="21px" fontWeight={500} color="black.900" truncateOverflow>
                    {value.name}
                  </P>
                  {value.type === 'USER' &&
                    (value.isIncognito ? (
                      <P fontSize="12px" lineHeight="18px" fontWeight="normal" color="black.500">
                        <FormattedMessage
                          id="profile.incognito.description"
                          defaultMessage="Keep my contribution private (see FAQ for more info)"
                        />
                      </P>
                    ) : (
                      <P fontSize="12px" lineHeight="18px" fontWeight="normal" color="black.500">
                        <FormattedMessage id="ContributionFlow.PersonalProfile" defaultMessage="Personal profile" /> -{' '}
                        {value.email}
                      </P>
                    ))}
                  {value.type === 'COLLECTIVE' && (
                    <P fontSize="12px" lineHeight="18px" fontWeight="normal" color="black.500">
                      <FormattedMessage id="ContributionFlow.CollectiveProfile" defaultMessage="Collective profile" />
                    </P>
                  )}
                  {value.type === 'ORGANIZATION' && (
                    <P fontSize="12px" lineHeight="18px" fontWeight="normal" color="black.500">
                      <FormattedMessage
                        id="ContributionFlow.OrganizationProfile"
                        defaultMessage="Organization profile"
                      />
                    </P>
                  )}
                </Flex>
                {key === 'org.new' && checked && (
                  <Container border="none" width={1} py={3}>
                    <Formik validate={validate} initialValues={initialValues} validateOnChange={true}>
                      {formik => {
                        const { values, errors, touched, setFieldValue } = formik;

                        const suggestedSlug = value => {
                          const slugOptions = {
                            replacement: '-',
                            lower: true,
                            strict: true,
                          };

                          return trim(slugify(value, slugOptions), '-');
                        };

                        const handleSlugChange = e => {
                          if (!touched.slug) {
                            setFieldValue('slug', suggestedSlug(e.target.value));
                          }
                        };

                        const setNewOrgProfile = () => {
                          // name, website, slug, twitterHandle
                          const obj = pick(values, ['name', 'website', 'slug', 'twitterHandle']);
                          console.log(obj);
                          onChange({ stepProfile: obj });
                          //console.log(reportValidityHTML5(formRef.current));
                        };

                        return (
                          <Form ref={formRef}>
                            <Box mb={3}>
                              <StyledInputField
                                label={intl.formatMessage(msg['org.name'])}
                                htmlFor="name"
                                name="name"
                                error={touched.name && errors.name}
                                value={values.name}
                                onChange={handleSlugChange}
                              >
                                {inputProps => (
                                  <Field
                                    as={StyledInput}
                                    {...inputProps}
                                    placeholder="e.g. AirBnb, Women Who Code"
                                    required
                                  />
                                )}
                              </StyledInputField>
                            </Box>

                            <Box mb={3}>
                              <StyledInputField
                                label={intl.formatMessage(msg['org.website'])}
                                htmlFor="website"
                                name="website"
                                error={touched.website && errors.website}
                                value={values.website}
                              >
                                {inputProps => (
                                  <Field
                                    as={StyledInput}
                                    {...inputProps}
                                    onChange={e => {
                                      setFieldValue('website', e.target.value);
                                      setNewOrgProfile();
                                    }}
                                    placeholder="https://example.com"
                                    type="url"
                                    required
                                  />
                                )}
                              </StyledInputField>
                            </Box>

                            <Box mb={3}>
                              <StyledInputField
                                label={intl.formatMessage(msg['org.slug'])}
                                htmlFor="slug"
                                name="slug"
                                error={touched.slug && errors.slug}
                                value={values.slug}
                              >
                                {inputProps => (
                                  <Field
                                    as={StyledInputGroup}
                                    {...inputProps}
                                    prepend="opencollective.com/"
                                    onChange={e => {
                                      setFieldValue('slug', e.target.value);
                                      setNewOrgProfile();
                                    }}
                                    placeholder="agora"
                                  />
                                )}
                              </StyledInputField>
                              {values.name.length > 0 && !touched.slug && (
                                <P fontSize="10px">{intl.formatMessage(msg.suggestedLabel)}</P>
                              )}
                            </Box>

                            <Box>
                              <StyledInputField
                                label={intl.formatMessage(msg['org.twitter'])}
                                name="twitterHandle"
                                htmlFor="twitterHandle"
                                error={touched.twitterHandle && errors.twitterHandle}
                                value={values.twitterHandle}
                              >
                                {inputProps => (
                                  <Field
                                    as={StyledInputGroup}
                                    {...inputProps}
                                    prepend="@"
                                    placeholder="agoracollective"
                                    onChange={e => {
                                      setFieldValue('twitterHandle', e.target.value);
                                      setNewOrgProfile();
                                    }}
                                  />
                                )}
                              </StyledInputField>
                            </Box>
                          </Form>
                        );
                      }}
                    </Formik>
                  </Container>
                )}
              </Flex>
            </Box>
          )}
        </StyledRadioList>
      </Box>
    </Fragment>
  );
};

NewContributionFlowStepProfileLoggedInForm.propTypes = {
  onChange: PropTypes.func,
  defaultSelectedProfile: PropTypes.object,
  profiles: PropTypes.array,
  canUseIncognito: PropTypes.bool,
  collective: PropTypes.object,
};

export default NewContributionFlowStepProfileLoggedInForm;
