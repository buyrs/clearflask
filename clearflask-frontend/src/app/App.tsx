import React, { Component } from 'react';
import { Server } from '../api/server';
import { match } from 'react-router';
import Header from './Header';
import { History, Location } from 'history';
import BasePage from './BasePage';
import { Provider } from 'react-redux';
import { detectEnv, Environment } from '../common/util/detectEnv';
import ServerMock from '../api/serverMock';
import DataMock from '../api/dataMock';
import Templater from '../common/config/configTemplater';
import * as ConfigEditor from '../common/config/configEditor';
import AppThemeProvider from './AppThemeProvider';
import {
  Route,
  Redirect,
} from 'react-router-dom'
import PostPage from './comps/PostPage';
import CustomPage from './CustomPage';
import { isExpanded } from './comps/Post';
import randomUuid from '../common/util/uuid';
import BankPage from './BankPage';
import AccountPage from './AccountPage';
import ServerErrorNotifier from './utils/ServerErrorNotifier';
import SsoLogin from './utils/SsoLogin';
import MuiSnackbarProvider from './utils/MuiSnackbarProvider';
import PushNotificationListener from './utils/PushNotificationListener';
import AnimatedPageSwitch from './utils/AnimatedRoutes';
import NotificationPage from './NotificationPage';

interface Props {
  serverOverride?:Server;
  supressCssBaseline?:boolean;
  isInsideContainer?:boolean;
  // Router matching
  match:match;
  history:History;
  location:Location;
}

class App extends Component<Props> {
  readonly server:Server;
  readonly uniqId = randomUuid();

  constructor(props) {
    super(props);

    this.state = {};

    var supressConfigGetAndBind = false;
    const projectId = this.props.match.params['projectId'];
    if(this.props.serverOverride) { 
      this.server = this.props.serverOverride;
    } else if(detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      supressConfigGetAndBind = true;
      this.server = new Server(projectId, ServerMock.get());
      this.server.dispatchAdmin()
        .then(d => d.projectCreateAdmin({projectId: projectId})
          .then(project =>{
            const editor = new ConfigEditor.EditorImpl(project.config.config);
            Templater.get(editor).demo();
            return d.configSetAdmin({
              projectId: projectId,
              versionLast: project.config.version,
              config: editor.getConfig(),
            });
          })
          .then(() => DataMock.get(projectId).mockAll())
          .then(() => {
            this.server.dispatch().configGet({projectId: projectId});
            if(this.server.getStore().getState().users.loggedIn.status === undefined) {
              this.server.dispatch().userBind({projectId: this.server.getProjectId()});
            }
          })
          .then(() => {if(projectId === 'mock-latency') ServerMock.get().setLatency(true)})
        );
    } else {
      this.server = new Server(projectId);
    }

    if(!supressConfigGetAndBind && this.server.getStore().getState().conf.status === undefined) {
      this.server.dispatch().configGet({projectId: this.server.getProjectId()});
      if(this.server.getStore().getState().users.loggedIn.status === undefined) {
        this.server.dispatch().userBind({projectId: this.server.getProjectId()});
      }
    }
  }

  render() {
    const prefixMatch = this.props.match.url;
    const appRootId = `appRoot-${this.server.getProjectId()}-${this.uniqId}`;
    return (
      <Provider store={this.server.getStore()}>
      <AppThemeProvider appRootId={appRootId} isInsideContainer={this.props.isInsideContainer} supressCssBaseline={this.props.supressCssBaseline}>
      <MuiSnackbarProvider>
        <PushNotificationListener server={this.server} />
        <ServerErrorNotifier server={this.server} />
        <SsoLogin server={this.server} />
        <div
          id={appRootId}
          style={{
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
            render={(pageSlug:string) => (
              <Route key={pageSlug} path={`${prefixMatch}/(embed)?/${pageSlug}`} render={props => (
                <BasePage>
                  <CustomPage
                    pageSlug={pageSlug}
                    server={this.server}
                    pageChanged={this.pageChanged.bind(this)}
                  />
                </BasePage>
              )} />
            )} >
            <Route path={`${prefixMatch}/transaction`} render={props => (
              <BasePage>
                <BankPage server={this.server} />
              </BasePage>
            )} />
            <Route path={`${prefixMatch}/notification`} render={props => (
              <BasePage>
                <NotificationPage server={this.server} />
              </BasePage>
            )} />
            <Route path={`${prefixMatch}/account`} render={props => (
              <BasePage>
                <AccountPage server={this.server} />
              </BasePage>
            )} />
            {!isExpanded() && (
              <Route path={`${prefixMatch}/post/:postId`} render={props => (
                <BasePage>
                  <PostPage
                    postId={props.match.params['postId'] || ''}
                    server={this.server}
                  />
                </BasePage>
              )} />
            )}
            {!isExpanded() && (
              <Route path={`${prefixMatch}/*/post/:postId`} render={props => (
                <Redirect exact to={{pathname: `${prefixMatch}/post/${props.match.params.postId}`}} />
              )} />
            )}
          </AnimatedPageSwitch>
        </div>
      </MuiSnackbarProvider>
      </AppThemeProvider>
      </Provider>
    );
  }

  pageChanged(pageUrlName:string):void {
    pageUrlName = pageUrlName === '' ? pageUrlName : '/' + pageUrlName
    this.props.history.push(`/${this.props.match.params['projectId']}${pageUrlName}`);
  }
}

export default App;
