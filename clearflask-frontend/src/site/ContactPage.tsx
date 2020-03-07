import { Box, Button, CardActions, CardHeader, Checkbox, Container, FormControlLabel, Grid, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { History } from 'history';
import React, { Component } from 'react';
import { match, Route } from 'react-router';
import ServerAdmin from '../api/serverAdmin';
import BasePage from '../app/BasePage';
import Message from '../app/comps/Message';
import MuiAnimatedSwitch from '../common/MuiAnimatedSwitch';

// If changed, also change in SupportResource.java
const TYPE = 'type';
// If changed, also change in SupportResource.java
const IMPORTANT = 'important';
// If changed, also change in SupportResource.java
const CONTACT = 'contact';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(2),
  },
  field: {
    margin: theme.spacing(2),
  },
  box: {
    border: '1px solid ' + theme.palette.grey[300],
  },
});

interface ContactForm {
  type: string;
  title: string;
  subtitle: string;
  submitTitle: string;
  fields: {
    attrName: string;
    title?: string;
    helperText?: string;
    placeholder?: string;
    type?: 'text' | 'multiline' | 'checkbox';
    required?: boolean;
  }[];
}

const forms: ContactForm[] = [{
  type: 'sales',
  title: 'Talk to sales',
  subtitle: 'Our experts can help you find the right solution',
  submitTitle: 'Schedule',
  fields: [
    { attrName: 'product', title: 'Company', placeholder: 'example.com' },
    { attrName: 'availability', title: 'Availability', placeholder: 'Tue 3-6pm PT', required: true },
    { attrName: CONTACT, title: 'Contact', placeholder: 'name@example.com', required: true },
  ],
}, {
  type: 'support',
  title: 'Customer support',
  submitTitle: 'Get support',
  subtitle: 'Need help? Found an issue?',
  fields: [
    { attrName: 'issue', type: 'multiline', title: 'Issue', required: true },
    { attrName: CONTACT, title: 'Contact', placeholder: 'name@example.com', required: true },
    { attrName: IMPORTANT, type: 'checkbox', title: 'Requires immediate attention' },
  ],
}, {
  type: 'general',
  title: 'Other inquiry',
  subtitle: 'Have a question for our team?',
  submitTitle: 'Contact us',
  fields: [
    { attrName: 'message', type: 'multiline', title: 'Inquiry', required: true },
    { attrName: CONTACT, title: 'Contact', placeholder: 'name@example.com', required: true },
  ],
},
];

interface Props {
  history: History;
  match: match;
}

interface State {
  isSubmitting?: boolean;
  // Also includes dynamic fields not covered by this interface
}

class ContactPage extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};
  render() {
    const prefixMatch = this.props.match.url;
    return (
      <MuiAnimatedSwitch>
        <Route exact key='success' path={`${prefixMatch}/success`} render={props => (
          <BasePage>
            <Box display='flex' justifyContent='center'>
              <Message variant='success' message='Your message has been sent!' />
            </Box>
          </BasePage>
        )} />
        {forms.map(form => (
          <Route exact key={form.type} path={`${prefixMatch}/${form.type}`} render={props => (
            <div className={this.props.classes.page}>
              <Container maxWidth='md'>
                <Grid container spacing={10} alignItems='stretch'>
                  <Grid item xs={12} sm={8}>
                    <Typography component="h1" variant="h2" color="textPrimary">{form.title}</Typography>
                    <Typography component="h2" variant="h4" color="textSecondary">{form.subtitle}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box display='flex' flexDirection='column'>
                      {form.fields.map(field => field.type === 'checkbox' ? (
                        <FormControlLabel
                          className={this.props.classes.field}
                          disabled={this.state.isSubmitting}
                          control={(
                            <Checkbox
                              color='primary'
                              checked={this.state[`field_${form.type}_${field.attrName}`] && true || false}
                              onChange={e => this.setState({ [`field_${form.type}_${field.attrName}`]: !this.state[`field_${form.type}_${field.attrName}`] })}
                            />
                          )}
                          label={field.title}
                        />
                      ) : (
                          <TextField
                            className={this.props.classes.field}
                            disabled={this.state.isSubmitting}
                            label={field.title}
                            placeholder={field.placeholder}
                            helperText={field.helperText}
                            value={this.state[`field_${form.type}_${field.attrName}`] || ''}
                            onChange={e => this.setState({ [`field_${form.type}_${field.attrName}`]: e.target.value })}
                            required={field.required}
                            multiline={field.type === 'multiline'}
                            rowsMax={field.type === 'multiline' ? 10 : undefined}
                          />
                        ))}
                      <Button
                        className={this.props.classes.field}
                        disabled={form.fields.some(field => field.required && !this.state[`field_${form.type}_${field.attrName}`])}
                        onClick={() => {
                          this.setState({ isSubmitting: true });
                          const content = {};
                          form.fields.forEach(field => content[field.attrName] = this.state[`field_${form.type}_${field.attrName}`]);
                          ServerAdmin.get().dispatchAdmin().then(d => d.supportMessage({
                            supportMessage: {
                              content: {
                                ...content,
                                [TYPE]: form.type,
                              }
                            }
                          }))
                            .then(() => {
                              this.setState({ isSubmitting: false });
                              this.props.history.push(`/contact/success`);
                            })
                            .catch(() => this.setState({ isSubmitting: false }));
                        }}
                        style={{
                          alignSelf: 'flex-end',
                        }}
                      >
                        {form.submitTitle}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Container>
            </div>
          )} />
        ))}
        <Route key='default' path={prefixMatch} render={props => (
          <BasePage>
            <Container maxWidth='md'>
              <Grid container spacing={5} alignItems='stretch' alignContent='stretch'>
                <Grid item xs={12}>
                  <Typography component="h1" variant="h2" color="textPrimary">How can we help?</Typography>
                </Grid>
                {forms.map(form => (
                  <Grid item xs={12} sm={4}>
                    <div>
                      <CardHeader
                        title={form.title}
                        subheader={form.subtitle}
                        style={{ flexGrow: 1 }}
                      />
                      <CardActions style={{ justifyContent: 'flex-end' }}>
                        <Button
                          onClick={() => this.props.history.push(`/contact/${form.type}`)}
                        >
                          {form.submitTitle}
                        </Button>
                      </CardActions>
                    </div>
                  </Grid>
                ))}
              </Grid>
            </Container>
          </BasePage>
        )} />
      </MuiAnimatedSwitch>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ContactPage);