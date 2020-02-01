package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.smotana.clearflask.api.IdeaAdminApi;
import com.smotana.clearflask.api.IdeaApi;
import com.smotana.clearflask.api.model.Idea;
import com.smotana.clearflask.api.model.IdeaCreate;
import com.smotana.clearflask.api.model.IdeaCreateAdmin;
import com.smotana.clearflask.api.model.IdeaSearch;
import com.smotana.clearflask.api.model.IdeaSearchAdmin;
import com.smotana.clearflask.api.model.IdeaSearchResponse;
import com.smotana.clearflask.api.model.IdeaUpdate;
import com.smotana.clearflask.api.model.IdeaUpdateAdmin;
import com.smotana.clearflask.api.model.IdeaWithAuthorAndVote;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.IdeaStore.SearchResponse;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

@Slf4j
@Singleton
@Path("/v1")
public class IdeaResource extends AbstractResource implements IdeaApi, IdeaAdminApi {

    @Inject
    private NotificationService notificationService;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private CommentStore commentStore;

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 30, challengeAfter = 10)
    @Override
    public Idea ideaCreate(String projectId, IdeaCreate ideaCreate) {
        UserSession session = getExtendedPrincipal().get().getUserSessionOpt().get();
        IdeaModel ideaModel = new IdeaModel(
                projectId,
                ideaStore.genIdeaId(ideaCreate.getTitle()),
                session.getUserId(),
                Instant.now(),
                ideaCreate.getTitle(),
                Strings.emptyToNull(ideaCreate.getDescription()),
                null,
                ideaCreate.getCategoryId(),
                null,
                ImmutableSet.copyOf(ideaCreate.getTagIds()),
                0L,
                0L,
                0L,
                BigDecimal.ZERO,
                ImmutableSet.of(),
                0L,
                0L,
                0d,
                ImmutableMap.of());
        ideaStore.createIdea(ideaModel);
        return ideaModel.toIdea();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaCreateAdmin(String projectId, IdeaCreateAdmin ideaCreateAdmin) {
        IdeaModel ideaModel = new IdeaModel(
                projectId,
                ideaStore.genIdeaId(ideaCreateAdmin.getTitle()),
                ideaCreateAdmin.getAuthorUserId(),
                Instant.now(),
                ideaCreateAdmin.getTitle(),
                Strings.emptyToNull(ideaCreateAdmin.getDescription()),
                Strings.emptyToNull(ideaCreateAdmin.getResponse()),
                ideaCreateAdmin.getCategoryId(),
                ideaCreateAdmin.getStatusId(),
                ImmutableSet.copyOf(ideaCreateAdmin.getTagIds()),
                0L,
                0L,
                0L,
                ideaCreateAdmin.getFundGoal(),
                ImmutableSet.of(),
                0L,
                0L,
                0d,
                ImmutableMap.of());
        ideaStore.createIdea(ideaModel);
        return ideaModel.toIdea();
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public IdeaWithAuthorAndVote ideaGet(String projectId, String ideaId) {
        return ideaStore.getIdea(projectId, ideaId)
                .map(IdeaModel::toIdeaWithAuthorAndVote)
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Idea not found"));
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaWithAuthorAndVote ideaGetAdmin(String projectId, String ideaId) {
        return ideaStore.getIdea(projectId, ideaId)
                .map(IdeaModel::toIdeaWithAuthorAndVote)
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Idea not found"));
    }

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public IdeaSearchResponse ideaSearch(String projectId, IdeaSearch ideaSearch, String cursor) {
        Optional<String> userIdOpt = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId);
        SearchResponse searchResponse = ideaStore.searchIdeas(
                projectId,
                ideaSearch,
                userIdOpt,
                Optional.ofNullable(Strings.emptyToNull(cursor)));

        ImmutableMap<String, IdeaModel> ideasById = ideaStore.getIdeas(projectId, searchResponse.getIdeaIds());

        return new IdeaSearchResponse(
                searchResponse.getCursorOpt().orElse(null),
                searchResponse.getIdeaIds().stream()
                        .map(ideasById::get)
                        .filter(Objects::nonNull)
                        .map(IdeaModel::toIdeaWithAuthorAndVote)
                        .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaSearchResponse ideaSearchAdmin(String projectId, IdeaSearchAdmin ideaSearchAdmin, String cursor) {
        SearchResponse searchResponse = ideaStore.searchIdeas(
                projectId,
                ideaSearchAdmin,
                false,
                Optional.ofNullable(Strings.emptyToNull(cursor)));

        ImmutableMap<String, IdeaModel> ideasById = ideaStore.getIdeas(projectId, searchResponse.getIdeaIds());

        return new IdeaSearchResponse(
                searchResponse.getCursorOpt().orElse(null),
                searchResponse.getIdeaIds().stream()
                        .map(ideasById::get)
                        .filter(Objects::nonNull)
                        .map(IdeaModel::toIdeaWithAuthorAndVote)
                        .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.IDEA_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaUpdate(String projectId, String ideaId, IdeaUpdate ideaUpdate) {
        return ideaStore.updateIdea(projectId, ideaId, ideaUpdate).getIdea().toIdea();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaUpdateAdmin(String projectId, String ideaId, IdeaUpdateAdmin ideaUpdateAdmin) {
        IdeaModel idea = ideaStore.updateIdea(projectId, ideaId, ideaUpdateAdmin).getIdea();
        if (ideaUpdateAdmin.getSuppressNotifications() != Boolean.TRUE) {
            boolean statusChanged = !Strings.isNullOrEmpty(ideaUpdateAdmin.getStatusId());
            boolean responseChanged = !Strings.isNullOrEmpty(ideaUpdateAdmin.getResponse());
            if (statusChanged || responseChanged) {
                notificationService.onStatusOrResponseChanged(idea, statusChanged, responseChanged);
            }
        }
        return idea.toIdea();
    }

    @RolesAllowed({Role.IDEA_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDelete(String projectId, String ideaId) {
        ideaStore.deleteIdea(projectId, ideaId);
        commentStore.deleteCommentsForIdea(projectId, ideaId);
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDeleteAdmin(String projectId, String ideaId) {
        ideaStore.deleteIdea(projectId, ideaId);
        commentStore.deleteCommentsForIdea(projectId, ideaId);
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDeleteBulkAdmin(String projectId, IdeaSearchAdmin ideaSearchAdmin) {
        SearchResponse searchResponse = null;
        do {
            searchResponse = ideaStore.searchIdeas(
                    projectId,
                    // TODO handle the limit somehow better here
                    ideaSearchAdmin.toBuilder().limit(Math.min(
                            ideaSearchAdmin.getLimit(),
                            DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE)).build(),
                    true,
                    searchResponse == null ? Optional.empty() : searchResponse.getCursorOpt());
            ideaStore.deleteIdeas(projectId, searchResponse.getIdeaIds());
            searchResponse.getIdeaIds().forEach(ideaId -> commentStore.deleteCommentsForIdea(projectId, ideaId));
        } while (!searchResponse.getCursorOpt().isPresent());
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(IdeaResource.class);
            }
        };
    }
}