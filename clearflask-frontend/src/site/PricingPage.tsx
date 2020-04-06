import { Box, Container, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@material-ui/core';
import { createStyles, Theme, useTheme, withStyles, WithStyles } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import CheckIcon from '@material-ui/icons/CheckRounded';
import { History } from 'history';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../api/admin';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import Loader from '../app/utils/Loader';
import HelpPopover from '../common/HelpPopover';
import notEmpty from '../common/util/arrayUtil';
import PlanPeriodSelect from './PlanPeriodSelect';
import PricingPlan from './PricingPlan';
import { PRE_SELECTED_PLAN_ID } from './SignupPage';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(6),
  },
  box: {
    border: '1px solid ' + theme.palette.grey[300],
  },
  billingSelect: {
    margin: theme.spacing(3),
  },
});

const T = true;
const F = false;

interface Props {
  history: History;
}
interface ConnectProps {
  plans?: Admin.Plan[];
  featuresTable?: Admin.FeaturesTable;
}
interface State {
  period?: Admin.PlanPricingPeriodEnum;
}

class PricingPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  render() {
    const allPlans = this.props.plans || [];
    const periodsSet = new Set(allPlans
      .map(plan => plan.pricing?.period)
      .filter(notEmpty));
    const periods = Object.keys(Admin.PlanPricingPeriodEnum).filter(period => periodsSet.has(period as any as Admin.PlanPricingPeriodEnum));
    const selectedPeriod = this.state.period
      || (periods.length > 0 ? periods[periods.length - 1] as any as Admin.PlanPricingPeriodEnum : undefined);
    const plans = allPlans
      .filter(plan => !plan.pricing || selectedPeriod === plan.pricing.period);
    return (
      <div className={this.props.classes.page}>
        <Container maxWidth='md'>
          <Typography component="h1" variant="h2" color="textPrimary">Compare pricing</Typography>
          <Typography component="h2" variant="h4" color="textSecondary">All plans include unlimited number of users.</Typography>
          <PlanPeriodSelect
            plans={this.props.plans}
            value={selectedPeriod}
            onChange={period => this.setState({ period })}
          />
        </Container>
        <Container maxWidth='md'>
          <Loader loaded={!!this.props.plans}>
            <Grid container spacing={5} alignItems='stretch'>
              {plans.map((plan, index) => (
                <Grid item key={plan.planid} xs={12} sm={index === 2 ? 12 : 6} md={4}>
                  <PricingPlan
                    plan={plan}
                    actionTitle={plan.comingSoon ? undefined : (plan.pricing && !plan.beta ? 'Get started' : 'Contact us')}
                    actionOnClick={plan.comingSoon ? undefined : () => plan.pricing && !plan.beta
                      ? this.props.history.push('/signup', { [PRE_SELECTED_PLAN_ID]: plan.planid })
                      : this.props.history.push('/contact/sales')
                    }
                  />
                </Grid>
              ))}
            </Grid>
          </Loader>
        </Container>
        <br />
        <br />
        <br />
        {this.props.featuresTable && (
          <Container maxWidth='md'>
            <FeatureList name='Features' planNames={this.props.featuresTable.plans}>
              {this.props.featuresTable.features.map((feature, index) => (
                <FeatureListItem
                  key={feature.feature}
                  planContents={this.mapFeaturesTableValues(feature.values)}
                  name={feature.feature}
                  helpText={feature.terms}
                />
              ))}
            </FeatureList>
            {this.props.featuresTable.extraTerms && (
              <Box display='flex' justifyContent='center'>
                <Typography variant='caption' component='div'>{this.props.featuresTable.extraTerms}</Typography>
              </Box>
            )}
          </Container>
        )}
      </div>
    );
  }

  mapFeaturesTableValues(values: string[]): (string | boolean)[] {
    return values.map(value => {
      switch (value) {
        case 'Yes': return T;
        case 'No': return F;
        default: return value;
      }
    });
  }
}

const FeatureList = withStyles(styles, { withTheme: true })((props: WithStyles<typeof styles, true> & {
  planNames: string[],
  name: string,
  children?: any,
}) => {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('sm'));
  return (
    <div className={props.classes.box}>
      <Table
        size={mdUp ? 'medium' : 'small'}
      >
        <TableHead>
          <TableRow>
            <TableCell key='feature'><Typography variant='h6'>{props.name}</Typography></TableCell>
            {props.planNames.map(planName => (
              <TableCell key={planName}>{planName}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {props.children}
        </TableBody>
      </Table>
    </div>
  );
});

const FeatureListItem = (props: {
  planContents: (boolean | React.ReactNode | string)[],
  name: string,
  helpText?: string
}) => {
  return (
    <TableRow key='name'>
      <TableCell key='feature'>
        {props.name}
        {props.helpText && (
          <React.Fragment>
            &nbsp;
            <HelpPopover description={props.helpText} />
          </React.Fragment>
        )}
      </TableCell>
      {props.planContents.map((content, index) => (
        <TableCell key={index}>
          {content === T
            ? (<CheckIcon fontSize='inherit' />)
            : content}
        </TableCell>
      ))}
    </TableRow>
  );
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  if (state.plans.plans.status === undefined) {
    ServerAdmin.get().dispatchAdmin().then(d => d.plansGet());
  }
  return {
    plans: state.plans.plans.plans,
    featuresTable: state.plans.plans.featuresTable,
  };
})(withStyles(styles, { withTheme: true })(PricingPage));
