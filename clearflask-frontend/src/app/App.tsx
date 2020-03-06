import { History, Location } from 'history';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { match } from 'react-router';
import { Redirect, Route } from 'react-router-dom';
import { Server } from '../api/server';
import ServerMock from '../api/serverMock';
import { detectEnv, Environment } from '../common/util/detectEnv';
import randomUuid from '../common/util/uuid';
import AccountPage from './AccountPage';
import AppThemeProvider from './AppThemeProvider';
import BankPage from './BankPage';
import BasePage from './BasePage';
import { isExpanded } from './comps/Post';
import PostPage from './comps/PostPage';
import CustomPage from './CustomPage';
import Header from './Header';
import NotificationPage from './NotificationPage';
import AnimatedPageSwitch from './utils/AnimatedRoutes';
import CaptchaChallenger from './utils/CaptchaChallenger';
import PushNotificationListener from './utils/PushNotificationListener';
import ServerErrorNotifier from './utils/ServerErrorNotifier';

interface Props {
  serverOverride?: Server;
  supressCssBaseline?: boolean;
  isInsideContainer?: boolean;
  // Router matching
  match: match;
  history: History;
  location: Location;
}

class App extends Component<Props> {
  readonly server: Server;
  readonly uniqId = randomUuid();

  constructor(props) {
    super(props);

    this.state = {};

    const projectId = this.props.match.params['projectId'];
    if (this.props.serverOverride) {
      this.server = this.props.serverOverride;
    } else if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      this.server = new Server(projectId, ServerMock.get());
    } else {
      this.server = new Server(projectId);
    }

    if (this.server.getStore().getState().conf.status === undefined) {
      this.server.dispatch().configGetAndUserBind({ projectId: this.server.getProjectId() });
    }
  }

  render() {
    const prefixMatch = this.props.match.url;
    const appRootId = `appRoot-${this.server.getProjectId()}-${this.uniqId}`;
    return (
      <Provider store={this.server.getStore()}>
        <AppThemeProvider
          appRootId={appRootId}
          isInsideContainer={this.props.isInsideContainer}
          supressCssBaseline={this.props.supressCssBaseline}
          containerStyle={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <PushNotificationListener server={this.server} />
          <ServerErrorNotifier server={this.server} />
          <CaptchaChallenger server={this.server} />
          {/* SSO not yet suppported <SsoLogin server={this.server} /> */}
          <div
            key={appRootId}
            id={appRootId}
            style={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              width: '100%',
              ...(this.props.isInsideContainer ? {
                position: 'relative',
              } : {}),
            }}
          >
            <Route path={`${prefixMatch}/:page?`} render={props => props.match.params['page'] === 'embed' ? null : (
              <Header
                pageSlug={props.match.params['page'] || ''}
                server={this.server}
                pageChanged={this.pageChanged.bind(this)}
              />
            )} />
            <AnimatedPageSwitch
              render={(pageSlug: string) => (
                <Route key={pageSlug} path={`${prefixMatch}/:embed(embed)?/${pageSlug}`} render={props => (
                  <BasePage showFooter={!props.match.params['embed']}>
                    <CustomPage
                      pageSlug={pageSlug}
                      server={this.server}
                      pageChanged={this.pageChanged.bind(this)}
                    />
                  </BasePage>
                )} />
              )} >
              <Route key='transaction' path={`${prefixMatch}/transaction`} render={props => (
                <BasePage showFooter>
                  <BankPage server={this.server} />
                </BasePage>
              )} />
              <Route key='notification' path={`${prefixMatch}/notification`} render={props => (
                <BasePage showFooter>
                  <NotificationPage server={this.server} />
                </BasePage>
              )} />
              <Route key='account' path={`${prefixMatch}/account`} render={props => (
                <BasePage showFooter>
                  <AccountPage server={this.server} />
                </BasePage>
              )} />
              {!isExpanded() && (
                <Route key='post' path={`${prefixMatch}/post/:postId`} render={props => (
                  <BasePage showFooter>
                    <PostPage
                      postId={props.match.params['postId'] || ''}
                      server={this.server}
                    />
                  </BasePage>
                )} />
              )}
              {!isExpanded() && (
                <Route key='postWildcard' path={`${prefixMatch}/*/post/:postId`} render={props => (
                  <Redirect exact to={{ pathname: `${prefixMatch}/post/${props.match.params.postId}` }} />
                )} />
              )}
            </AnimatedPageSwitch>
          </div>
        </AppThemeProvider>
      </Provider>
    );
  }

  pageChanged(pageUrlName: string): void {
    pageUrlName = pageUrlName === '' ? pageUrlName : '/' + pageUrlName
    this.props.history.push(`/${this.props.match.params['projectId']}${pageUrlName}`);
  }
}

export default App;
