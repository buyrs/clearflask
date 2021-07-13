import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { MarginProperty } from 'csstype';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../../api/server';
import { notEmpty } from '../../common/util/arrayUtil';
import keyMapper from '../../common/util/keyMapper';
import { customShouldComponentUpdate } from '../../common/util/reactUtil';
import { MutableRef } from '../../common/util/refUtil';
import { selectorContentWrap } from '../../common/util/reselectUtil';
import { TabFragment, TabsVertical } from '../../common/util/tabsUtil';
import ErrorMsg from '../ErrorMsg';
import Loading from '../utils/Loading';
import LoadMoreButton from './LoadMoreButton';
import Panel, { PanelTitle } from './Panel';
import Post, { MaxContentWidth } from './Post';

export interface PanelPostNavigator {
  hasPrevious(): boolean;
  getPreviousId(): string | undefined;
  previous(): boolean;
  hasNext(): boolean;
  getNextId(): Promise<string | undefined>;
  next(): Promise<boolean>;
}

export enum Direction {
  Horizontal,
  Vertical,
}

const styles = (theme: Theme) => createStyles({
  placeholder: {
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
    boxSizing: 'border-box',
    width: (props: Props) => props.widthExpand ? MaxContentWidth : '100%',
    maxWidth: (props: Props) => props.widthExpand ? '100%' : MaxContentWidth,
    display: 'inline-block',
  },
  widthExpandMarginSupplied: {
    padding: (props: Props) => props.widthExpandMargin,
  },
  widthExpandMargin: {
    [theme.breakpoints.only('xs')]: {
      padding: theme.spacing(2, 2),
      '&:first-child': { paddingTop: theme.spacing(4) },
      '&:last-child': { paddingBottom: theme.spacing(4) },
    },
    [theme.breakpoints.only('sm')]: {
      padding: theme.spacing(2, 2),
      '&:first-child': { paddingTop: theme.spacing(4) },
      '&:last-child': { paddingBottom: theme.spacing(4) },
    },
    [theme.breakpoints.up('md')]: {
      padding: theme.spacing(3, 4),
      '&:first-child': { paddingTop: theme.spacing(6) },
      '&:last-child': { paddingBottom: theme.spacing(6) },
    },
  },
});

export interface Props {
  className?: string;
  postClassName?: string;
  server: Server;
  panel?: Partial<Client.PagePanel | Client.PagePanelWithHideIfEmpty | Client.PageExplorer>;
  overrideTitle?: React.ReactNode;
  preContent?: React.ReactNode;
  widthExpand?: boolean;
  widthExpandMargin?: MarginProperty<string | number>;
  displayDefaults?: Client.PostDisplay;
  searchOverride?: Partial<Client.IdeaSearch>;
  searchOverrideAdmin?: Partial<Admin.IdeaSearchAdmin>;
  direction: Direction;
  maxHeight?: string | number;
  onClickPost?: (postId: string) => void;
  onClickPostExpand?: boolean;
  onUserClick?: (userId: string) => void;
  disableOnClick?: boolean;
  suppressPanel?: boolean;
  PostProps?: Partial<React.ComponentProps<typeof Post>>;
  renderPost?: (post: Client.Idea, index: number) => React.ReactNode;
  wrapPost?: (post: Client.Idea, postNode: React.ReactNode, index: number) => React.ReactNode;
  onHasAnyChanged?: (hasAny: boolean, count: number) => void;
  navigatorRef?: MutableRef<PanelPostNavigator>;
  selectable?: boolean;
  selected?: string;
  navigatorChanged?: () => void;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  searchStatus?: Status;
  searchIdeas: Client.Idea[];
  searchCursor: string | undefined,
  missingVotes?: string[];
  projectId?: string;
  loggedInUser?: Client.User;
}
interface State {
  expandedPostId?: string;
}
class PanelPost extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> implements PanelPostNavigator {
  state: State = {};
  notifiedHasAnyCount?: number;

  constructor(props) {
    super(props);

    if (props.navigatorRef) props.navigatorRef.current = this;

    if (!props.searchStatus) {
      this.loadMore();
    } else if (props.missingVotes?.length) {
      props.server.dispatch().then(d => d.ideaVoteGetOwn({
        projectId: props.projectId,
        ideaIds: props.missingVotes,
        myOwnIdeaIds: props.missingVotes
          .map(ideaId => props.searchIdeas.find(i => i.ideaId === ideaId))
          .filter(idea => idea?.idea?.authorUserId === props.loggedInUser?.userId)
          .map(idea => idea?.idea?.ideaId)
          .filter(notEmpty),
      }));
    }
  }

  async loadMore(): Promise<undefined | Client.IdeaWithVoteSearchResponse | Admin.IdeaSearchResponse> {
    if (!this.props.projectId) return;
    if (!!this.props.searchStatus && !this.props.searchCursor) return;
    if (!this.props.searchOverrideAdmin) {
      return await (await this.props.server.dispatch({ ssr: true })).ideaSearch({
        projectId: this.props.projectId,
        ideaSearch: {
          ...(this.props.panel?.search || {}),
          ...this.props.searchOverride,
        },
        cursor: this.props.searchCursor,
      });
    } else {
      return await (await this.props.server.dispatchAdmin({ ssr: true })).ideaSearchAdmin({
        projectId: this.props.projectId,
        ideaSearchAdmin: {
          ...(this.props.panel?.search || {}),
          ...this.props.searchOverrideAdmin,
        } as any,
        cursor: this.props.searchCursor,
      });
    }
  }

  shouldComponentUpdate = customShouldComponentUpdate({
    nested: new Set(['panel', 'displayDefaults', 'searchOverride', 'searchOverrideAdmin', 'PostProps']),
  });

  componentDidUpdate(prevProps, prevState) {
    if (!!this.props.navigatorChanged
      && (this.props.searchCursor !== prevProps.searchCursor
        || this.props.searchIdeas.length !== prevProps.searchIdeas.length
        || this.props.selected !== prevProps.selected)) {
      this.props.navigatorChanged();
    }
  }

  render() {
    const widthExpandMarginClassName = this.props.widthExpandMargin === undefined
      ? this.props.classes.widthExpandMargin : this.props.classes.widthExpandMarginSupplied;
    const hideIfEmpty = !!this.props.panel?.['hideIfEmpty'];
    const hasAny = !!this.props.searchIdeas.length;
    var content;
    if (!this.props.searchStatus || this.props.searchStatus === Status.REJECTED) {
      content = (
        <div className={classNames(this.props.widthExpand && widthExpandMarginClassName, this.props.classes.placeholder)}>
          <ErrorMsg msg='Failed to load' />
        </div>
      );
    } else if (hideIfEmpty && !hasAny) {
      return null;
    } else if (this.props.searchStatus === Status.PENDING && !hasAny) {
      content = (
        <div className={classNames(this.props.widthExpand && widthExpandMarginClassName, this.props.classes.placeholder)}>
          <Loading />
        </div>
      );
    } else {
      if (!!this.props.onHasAnyChanged && (this.notifiedHasAnyCount !== this.props.searchIdeas.length)) {
        this.notifiedHasAnyCount = this.props.searchIdeas.length;
        this.props.onHasAnyChanged(hasAny, this.props.searchIdeas.length);
      }

      const onlyHasOneCategory = (this.props.config && this.props.config.content.categories.length <= 1
        || (this.props.panel?.search?.filterCategoryIds?.length === 1));

      const display: Client.PostDisplay = {
        titleTruncateLines: 1,
        descriptionTruncateLines: 2,
        ...(onlyHasOneCategory ? { showCategoryName: false } : {}),
        ...(this.props.displayDefaults || {}),
        ...(this.props.panel?.display || {}),
      }

      const onClickPost = (!this.props.onClickPost && !this.props.onClickPostExpand) ? undefined : postId => {
        this.props.onClickPost?.(postId);
        this.props.onClickPostExpand && this.setState({ expandedPostId: postId === this.state.expandedPostId ? undefined : postId });
      };
      content = this.props.searchIdeas.map((idea, ideaIndex) => {
        var content: React.ReactNode;
        if (this.props.renderPost) {
          content = this.props.renderPost(idea, ideaIndex);
        } else {
          const displayForThisPost = this.state.expandedPostId !== idea.ideaId ? display : {
            ...display,
            titleTruncateLines: undefined,
            descriptionTruncateLines: undefined,
          };
          content = (
            <Post
              className={classNames(
                this.props.postClassName,
              )}
              classNamePadding={classNames(
                this.props.widthExpand && widthExpandMarginClassName,
              )}
              server={this.props.server}
              idea={idea}
              widthExpand={this.props.widthExpand}
              expandable
              disableOnClick={this.props.disableOnClick}
              onClickPost={onClickPost}
              onUserClick={this.props.onUserClick}
              display={displayForThisPost}
              variant='list'
              {...this.props.PostProps}
            />
          );
        }
        if (this.props.wrapPost) {
          content = this.props.wrapPost(idea, content, ideaIndex);
        }
        if (this.props.selectable) {
          content = (
            <TabFragment key={idea.ideaId} value={idea.ideaId}>
              {content}
            </TabFragment>
          );
        } else {
          content = (
            <React.Fragment key={idea.ideaId}>
              {content}
            </React.Fragment>
          );
        }
        return content;
      });
      if (this.props.selectable) {
        content = (
          <TabsVertical
            selected={this.props.selected}
            onClick={this.props.onClickPost ? (postId => this.props.onClickPost?.(postId)) : undefined}
          >
            {content}
          </TabsVertical>
        );
      }
      if (!this.props.searchIdeas.length) {
        content = (
          <>
            {content}
            <div
              className={classNames(
                this.props.widthExpand && widthExpandMarginClassName,
                this.props.classes.placeholder,
              )}
            >
              <Typography variant='overline' style={{
              }}>Nothing found</Typography>
            </div>
          </>
        );
      }
    }
    if (this.props.searchCursor) {
      content = (
        <>
          {content}
          <LoadMoreButton onClick={() => this.loadMore()} />
        </>
      );
    }
    const title = this.props.overrideTitle !== undefined ? this.props.overrideTitle : (!this.props.panel?.['title'] ? undefined : (
      <PanelTitle
        text={this.props.panel['title']}
        color={this.props.panel['color']}
      />
    ));
    if (title !== undefined) {
      content = this.props.suppressPanel ? (
        <>
          {title}
          {content}
        </>
      ) : (
        <Panel
          className={classNames(this.props.className)}
          title={title}
          direction={this.props.direction}
          maxHeight={this.props.maxHeight}
        >
          {this.props.preContent}
          {content}
        </Panel>
      );
    }
    return content;
  }

  hasPrevious(): boolean {
    if (!this.props.selected) return false;
    const selectedIndex = this.props.searchIdeas.findIndex(idea => idea.ideaId === this.props.selected);
    return selectedIndex >= 1;
  }

  getPreviousId(): string | undefined {
    if (!this.props.selected) return undefined;
    const selectedIndex = this.props.searchIdeas.findIndex(idea => idea.ideaId === this.props.selected);
    const previousPostId = this.props.searchIdeas[selectedIndex - 1]?.ideaId;
    return previousPostId;
  }

  previous(): boolean {
    if (!this.props.onClickPost) return false;
    const previousPostId = this.getPreviousId();
    if (!previousPostId) return false;
    this.props.onClickPost(previousPostId);
    return true;
  }

  hasNext(): boolean {
    if (!this.props.selected) return false;
    const selectedIndex = this.props.searchIdeas.findIndex(idea => idea.ideaId === this.props.selected);
    return selectedIndex !== -1
      && (selectedIndex < (this.props.searchIdeas.length - 1) || !!this.props.searchCursor);
  }

  async getNextId(): Promise<string | undefined> {
    if (!this.props.selected) return undefined;
    const selectedIndex = this.props.searchIdeas.findIndex(idea => idea.ideaId === this.props.selected);
    if (selectedIndex === -1) return undefined;
    var nextPostId: string | undefined;
    if (selectedIndex === (this.props.searchIdeas.length - 1)) {
      const result = await this.loadMore();
      nextPostId = result?.results[0]?.ideaId;
    } else {
      nextPostId = this.props.searchIdeas[selectedIndex + 1]?.ideaId;
    }
    return nextPostId;
  }

  async next(): Promise<boolean> {
    if (!this.props.onClickPost) return false;
    const nextPostId = await this.getNextId();
    if (!nextPostId) return false;
    this.props.onClickPost(nextPostId);
    return true;
  }
}

export default keyMapper(
  (ownProps: Props) => getSearchKey({
    ...(ownProps.panel?.search || {}),
    ...ownProps.searchOverride,
    ...ownProps.searchOverrideAdmin,
  }),
  connect<ConnectProps, {}, Props, ReduxState>(() => {
    const selectIsAdminSearch = (_, ownProps: Props): boolean => !!ownProps.searchOverrideAdmin;
    const selectSearchMerged = (_, ownProps: Props): Client.IdeaSearch | Admin.IdeaSearchAdmin => ({
      ...(ownProps.panel?.search || {}),
      ...ownProps.searchOverride,
      ...ownProps.searchOverrideAdmin,
    });
    const selectSearchKey = createSelector(
      [selectSearchMerged],
      (searchMerged) => getSearchKey(searchMerged)
    );
    const selectIdeasBySearch = (state: ReduxState) => state.ideas.bySearch;
    const selectIdeasById = (state: ReduxState) => state.ideas.byId;
    const selectSearch = createSelector(
      [selectSearchKey, selectIdeasBySearch],
      (searchKey, ideasBySearch) => searchKey ? ideasBySearch[searchKey] : undefined
    );
    const selectVotesStatusByIdeaId = (state: ReduxState) => state.votes.statusByIdeaId;

    const selectLoggedInUser = (state: ReduxState) => state.users.loggedIn.user;
    const selectMissingVotes = selectorContentWrap(createSelector(
      [selectSearch, selectVotesStatusByIdeaId, selectLoggedInUser, selectIsAdminSearch],
      (search, votesStatusByIdeaId, loggedInUser, isAdminSearch) => {
        const missing: string[] = [];
        // Don't get votes if calling admin search or not logged in
        if (isAdminSearch || !loggedInUser) return missing;
        search?.ideaIds?.forEach(ideaId => {
          if (votesStatusByIdeaId[ideaId] === undefined) {
            missing.push(ideaId);
          }
        });
        return missing.length ? missing : undefined;
      }
    ));

    const selectIdeas = selectorContentWrap(createSelector(
      [selectSearch, selectIdeasById],
      (search, byId) => {
        const ideas = (search?.ideaIds || []).map(ideaId => {
          const idea = byId[ideaId];
          if (!idea || idea.status !== Status.FULFILLED) return undefined;
          return idea.idea;
        }).filter(notEmpty);
        return ideas.length ? ideas : undefined;
      }));

    const selectConnectProps = createSelector(
      selectMissingVotes,
      selectIdeas,
      selectSearch,
      (state: ReduxState) => state.conf.ver,
      (state: ReduxState) => state.conf.conf,
      (state: ReduxState) => state.projectId,
      selectLoggedInUser,
      (missingVotes, ideas, search, configver, config, projectId, loggedInUser) => {
        const connectProps: ConnectProps = {
          config,
          configver,
          searchStatus: search?.status,
          searchCursor: search?.cursor,
          searchIdeas: ideas || [],
          missingVotes,
          projectId: projectId || undefined,
          loggedInUser,
        };
        return connectProps;
      });
    return (state, ownProps) => selectConnectProps(state, ownProps);
  })(withStyles(styles, { withTheme: true })(PanelPost)));
