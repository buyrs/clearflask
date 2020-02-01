package com.smotana.clearflask.store.dynamo.mapper;

import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Index;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.KeyAttribute;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.BillingMode;
import com.amazonaws.services.dynamodbv2.model.CreateTableRequest;
import com.amazonaws.services.dynamodbv2.model.GlobalSecondaryIndex;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.LocalSecondaryIndex;
import com.amazonaws.services.dynamodbv2.model.Projection;
import com.amazonaws.services.dynamodbv2.model.ProjectionType;
import com.amazonaws.services.dynamodbv2.model.ResourceNotFoundException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.google.common.base.Preconditions;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.CollectionMarshallerAttrVal;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.CollectionMarshallerItem;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.CollectionUnMarshallerAttrVal;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.CollectionUnMarshallerItem;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.MarshallerAttrVal;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.MarshallerItem;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.UnMarshallerAttrVal;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.UnMarshallerItem;
import com.smotana.clearflask.util.GsonProvider;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.util.StringSerdeUtil;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.ArrayUtils;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.lang.reflect.Parameter;
import java.lang.reflect.ParameterizedType;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.stream.LongStream;
import java.util.stream.Stream;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.google.common.base.Preconditions.checkState;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.*;

@Slf4j
@Singleton
public class DynamoMapperImpl extends ManagedService implements DynamoMapper {

    public interface Config {
        @DefaultValue("true")
        boolean createTables();

        @DefaultValue("1")
        long gsiCount();

        @DefaultValue("0")
        long lsiCount();
    }

    @Inject
    private Config config;
    @Inject
    private DynamoDB dynamoDoc;

    private final DynamoConvertersProxy.Converters converters = DynamoConvertersProxy.proxy();
    private final MarshallerItem gsonMarshallerItem = (o, a, i) -> i.withString(a, GsonProvider.GSON.toJson(o));
    private final MarshallerAttrVal gsonMarshallerAttrVal = o -> new AttributeValue().withS(GsonProvider.GSON.toJson(o));
    private final Function<Class, UnMarshallerAttrVal> gsonUnMarshallerAttrVal = k -> a -> GsonProvider.GSON.fromJson(a.getS(), k);
    private final Function<Class, UnMarshallerItem> gsonUnMarshallerItem = k -> (a, i) -> GsonProvider.GSON.fromJson(i.getString(a), k);
    private final Map<String, DynamoTable> rangePrefixToDynamoTable = Maps.newHashMap();

    @Override
    protected void serviceStart() throws Exception {
        if (config.createTables()) {
            try {
                ArrayList<KeySchemaElement> primaryKeySchemas = Lists.newArrayList();
                ArrayList<AttributeDefinition> primaryAttributeDefinitions = Lists.newArrayList();
                ArrayList<LocalSecondaryIndex> localSecondaryIndexes = Lists.newArrayList();
                ArrayList<GlobalSecondaryIndex> globalSecondaryIndexes = Lists.newArrayList();

                primaryKeySchemas.add(new KeySchemaElement(getPartitionKeyName(Primary, -1), KeyType.HASH));
                primaryAttributeDefinitions.add(new AttributeDefinition(getPartitionKeyName(Primary, -1), ScalarAttributeType.S));
                primaryKeySchemas.add(new KeySchemaElement(getRangeKeyName(Primary, -1), KeyType.RANGE));
                primaryAttributeDefinitions.add(new AttributeDefinition(getRangeKeyName(Primary, -1), ScalarAttributeType.S));

                LongStream.range(1, config.lsiCount() + 1).forEach(indexNumber -> {
                    localSecondaryIndexes.add(new LocalSecondaryIndex()
                            .withIndexName(getTableOrIndexName(Lsi, indexNumber))
                            .withProjection(new Projection().withProjectionType(ProjectionType.ALL))
                            .withKeySchema(ImmutableList.of(
                                    new KeySchemaElement(getPartitionKeyName(Lsi, indexNumber), KeyType.HASH),
                                    new KeySchemaElement(getRangeKeyName(Lsi, indexNumber), KeyType.RANGE))));
                    primaryAttributeDefinitions.add(new AttributeDefinition(getRangeKeyName(Lsi, indexNumber), ScalarAttributeType.S));
                });

                LongStream.range(1, config.gsiCount() + 1).forEach(indexNumber -> {
                    globalSecondaryIndexes.add(new GlobalSecondaryIndex()
                            .withIndexName(getTableOrIndexName(Gsi, indexNumber))
                            .withProjection(new Projection().withProjectionType(ProjectionType.ALL))
                            .withKeySchema(ImmutableList.of(
                                    new KeySchemaElement(getPartitionKeyName(Gsi, indexNumber), KeyType.HASH),
                                    new KeySchemaElement(getRangeKeyName(Gsi, indexNumber), KeyType.RANGE))));
                    primaryAttributeDefinitions.add(new AttributeDefinition(getPartitionKeyName(Gsi, indexNumber), ScalarAttributeType.S));
                    primaryAttributeDefinitions.add(new AttributeDefinition(getRangeKeyName(Gsi, indexNumber), ScalarAttributeType.S));
                });

                CreateTableRequest createTableRequest = new CreateTableRequest()
                        .withTableName(getTableOrIndexName(Primary, -1))
                        .withKeySchema(primaryKeySchemas)
                        .withAttributeDefinitions(primaryAttributeDefinitions)
                        .withBillingMode(BillingMode.PAY_PER_REQUEST);
                if (!localSecondaryIndexes.isEmpty()) {
                    createTableRequest.withLocalSecondaryIndexes(localSecondaryIndexes);
                }
                if (!globalSecondaryIndexes.isEmpty()) {
                    createTableRequest.withGlobalSecondaryIndexes(globalSecondaryIndexes);
                }
                dynamoDoc.createTable(createTableRequest);
                log.info("Table {} created", getTableOrIndexName(Primary, -1));
            } catch (ResourceNotFoundException ex) {
                log.trace("Table {} already exists", getTableOrIndexName(Primary, -1));
            }
        }
    }

    @Override
    public <T> TableSchema<T> parseTableSchema(Class<T> objClazz) {
        return parseSchema(Primary, -1, objClazz);
    }

    @Override
    public <T> IndexSchema<T> parseLocalSecondaryIndexSchema(long indexNumber, Class<T> objClazz) {
        return parseSchema(Lsi, indexNumber, objClazz);
    }

    @Override
    public <T> IndexSchema<T> parseGlobalSecondaryIndexSchema(long indexNumber, Class<T> objClazz) {
        return parseSchema(Gsi, indexNumber, objClazz);
    }

    private String getTableOrIndexName(TableType type, long indexNumber) {
        return type == Primary
                ? type.name().toLowerCase()
                : type.name().toLowerCase() + indexNumber;
    }

    private String getPartitionKeyName(TableType type, long indexNumber) {
        return type == Primary || type == Lsi
                ? "pk"
                : type.name().toLowerCase() + "pk" + indexNumber;
    }

    private String getRangeKeyName(TableType type, long indexNumber) {
        return type == Primary
                ? "sk"
                : type.name().toLowerCase() + "sk" + indexNumber;
    }

    private <T> SchemaImpl<T> parseSchema(TableType type, long indexNumber, Class<T> objClazz) {
        DynamoTable[] dynamoTables = objClazz.getDeclaredAnnotationsByType(DynamoTable.class);
        checkState(dynamoTables != null && dynamoTables.length > 0,
                "Class " + objClazz + " is missing DynamoTable annotation");
        DynamoTable dynamoTable = Arrays.stream(dynamoTables)
                .filter(dt -> dt.type() == type)
                .filter(dt -> dt.indexNumber() == indexNumber)
                .findAny()
                .orElseThrow(() -> new IllegalStateException("Class " + objClazz + " is missing table type " + type));
        String[] partitionKeys = dynamoTable.partitionKeys();
        String[] rangeKeys = dynamoTable.rangeKeys();
        String rangePrefix = dynamoTable.rangePrefix();
        String tableName = getTableOrIndexName(type, indexNumber);
        String partitionKeyName = getPartitionKeyName(type, indexNumber);
        String rangeKeyName = getRangeKeyName(type, indexNumber);

        DynamoTable dynamoTableOther = rangePrefixToDynamoTable.putIfAbsent(rangePrefix, dynamoTable);
        checkState(dynamoTableOther == null || dynamoTableOther == dynamoTable, "Detected multiple schemas with same rangePrefix %s, one in %s and other in %s", rangePrefix, dynamoTable, dynamoTableOther);

        Table table = dynamoDoc.getTable(getTableOrIndexName(Primary, -1));
        Index index = type != Primary
                ? table.getIndex(tableName)
                : null;

        Map<String, Function<Item, Object>> keyFromItemToVal = Maps.newHashMap();
        Map<String, Function<Map<String, AttributeValue>, Object>> keyFromAttrMapToVal = Maps.newHashMap();
        for (Field field : objClazz.getDeclaredFields()) {
            for (DynamoTable dt : dynamoTables) {
                String fieldName = field.getName();
                Arrays.stream(dt.rangeKeys()).anyMatch(fieldName::equals);
                int partitionKeyIndex = ArrayUtils.indexOf(dt.partitionKeys(), fieldName);
                int rangeKeyIndex = ArrayUtils.indexOf(dt.rangeKeys(), fieldName);
                if (partitionKeyIndex == -1 && rangeKeyIndex == -1) {
                    continue;
                }

                Class<?> fieldClazz = field.getType();
                String dtKeyName;
                int dtKeyIndex;
                if (partitionKeyIndex != -1 &&
                        (rangeKeyIndex == -1 || dt.partitionKeys().length <= dt.rangeKeys().length)) {
                    dtKeyName = getPartitionKeyName(dt.type(), dt.indexNumber());
                    dtKeyIndex = partitionKeyIndex;
                } else {
                    dtKeyName = getRangeKeyName(dt.type(), dt.indexNumber());
                    dtKeyIndex = rangeKeyIndex + 1; // +1 for rangePrefix
                }
                keyFromItemToVal.put(fieldName, (item) -> GsonProvider.GSON.fromJson(
                        StringSerdeUtil.unMergeString(checkNotNull(item.getString(dtKeyName),
                                "Key %s is missing trying to retrieve %s for %s", dtKeyName, fieldName, fieldClazz))
                                [dtKeyIndex], fieldClazz));
                keyFromAttrMapToVal.put(fieldName, (attrMap) -> GsonProvider.GSON.fromJson(
                        StringSerdeUtil.unMergeString(checkNotNull(attrMap.get(dtKeyName),
                                "Key %s is missing trying to retrieve %s for %s", dtKeyName, fieldName, fieldClazz)
                                .getS())[dtKeyIndex], fieldClazz));
            }
        }

        ImmutableMap.Builder<String, MarshallerItem> fieldMarshallersBuilder = ImmutableMap.builder();
        ImmutableMap.Builder<String, UnMarshallerItem> fieldUnMarshallersBuilder = ImmutableMap.builder();
        ImmutableList.Builder<Function<Item, Object>> fromItemToCtorArgsListBuilder = ImmutableList.builder();
        ImmutableList.Builder<Function<Map<String, AttributeValue>, Object>> fromAttrMapToCtorArgsListBuilder = ImmutableList.builder();
        ImmutableMap.Builder<String, Function<T, Object>> objToFieldValsBuilder = ImmutableMap.builder();
        Field[] partitionKeyFields = new Field[partitionKeys.length];
        Field[] rangeKeyFields = new Field[rangeKeys.length];
        ImmutableList.Builder<BiConsumer<Item, T>> toItemArgsBuilder = ImmutableList.builder();
        ImmutableList.Builder<BiConsumer<ImmutableMap.Builder<String, AttributeValue>, T>> toAttrMapArgsBuilder = ImmutableList.builder();

        for (Field field : objClazz.getDeclaredFields()) {
            String fieldName = field.getName();
            checkState(Modifier.isFinal(field.getModifiers()),
                    "Cannot map class %s to item,field %s is not final",
                    objClazz.getSimpleName(), fieldName);
            field.setAccessible(true);
            Optional<Class> collectionClazz = getCollectionClazz(field.getType());
            Class fieldClazz = collectionClazz.isPresent() ? getCollectionGeneric(field) : field.getType();

            Function<T, Object> objToFieldVal = obj -> {
                try {
                    return field.get(obj);
                } catch (IllegalAccessException ex) {
                    throw new RuntimeException(ex);
                }
            };
            objToFieldValsBuilder.put(fieldName, objToFieldVal);

            // fromItem
            UnMarshallerItem unMarshallerItem = findUnMarshallerItem(collectionClazz, fieldClazz);
            if (keyFromItemToVal.containsKey(fieldName)) {
                fromItemToCtorArgsListBuilder.add(keyFromItemToVal.get(fieldName));
            } else {
                fromItemToCtorArgsListBuilder.add((item) ->
                        (!collectionClazz.isPresent() && (!item.isPresent(fieldName) || item.isNull(fieldName)))
                                ? null
                                : unMarshallerItem.unmarshall(fieldName, item));
            }

            // fromAttrMap
            UnMarshallerAttrVal unMarshallerAttrVal = findUnMarshallerAttrVal(collectionClazz, fieldClazz);
            if (keyFromAttrMapToVal.containsKey(fieldName)) {
                fromAttrMapToCtorArgsListBuilder.add(keyFromAttrMapToVal.get(fieldName));
            } else {
                fromAttrMapToCtorArgsListBuilder.add((attrMap) -> {
                    AttributeValue attrVal = attrMap.get(fieldName);
                    return (!collectionClazz.isPresent() && (attrVal == null || attrVal.getNULL() == Boolean.TRUE))
                            ? null
                            : unMarshallerAttrVal.unmarshall(attrVal);
                });
            }

            boolean isSet = Set.class.isAssignableFrom(field.getType());

            // toItem toAttrVal
            for (int i = 0; i < partitionKeys.length; i++) {
                if (fieldName.equals(partitionKeys[i])) {
                    partitionKeyFields[i] = field;
                }
            }
            for (int i = 0; i < rangeKeys.length; i++) {
                if (fieldName.equals(rangeKeys[i])) {
                    rangeKeyFields[i] = field;
                }
            }

            // toItem
            MarshallerItem marshallerItem = findMarshallerItem(collectionClazz, fieldClazz);
            if (!keyFromItemToVal.containsKey(fieldName)) {
                toItemArgsBuilder.add((item, object) -> {
                    Object val = objToFieldVal.apply(object);
                    if (isSet && val == null && LogUtil.rateLimitAllowLog("dynamomapper-set-missing-nonnull")) {
                        log.warn("Field {} in class {} missing @NonNull. All sets are required to be non null since" +
                                        " empty set is not allowed by DynamoDB and there is no distinction between null and empty set.",
                                fieldName, object.getClass().getSimpleName());
                    }
                    if (val == null) {
                        return; // Omit null
                    }
                    marshallerItem.marshall(val, fieldName, item);
                });
            }

            // toAttrVal
            MarshallerAttrVal marshallerAttrVal = findMarshallerAttrVal(collectionClazz, fieldClazz);
            if (!keyFromAttrMapToVal.containsKey(fieldName)) {
                toAttrMapArgsBuilder.add((mapBuilder, object) -> {
                    Object val = objToFieldVal.apply(object);
                    if (isSet && val == null && LogUtil.rateLimitAllowLog("dynamomapper-set-missing-nonnull")) {
                        log.warn("Field {} in class {} missing @NonNull. All sets are required to be non null since" +
                                        " empty set is not allowed by DynamoDB and there is no distinction between null and empty set.",
                                fieldName, object.getClass().getSimpleName());
                    }
                    if (val == null) {
                        return; // Omit null
                    }
                    AttributeValue valMarsh = marshallerAttrVal.marshall(val);
                    if (valMarsh == null) {
                        return; // Omit null
                    }
                    mapBuilder.put(fieldName, valMarsh);
                });
            }

            // toDynamoValue fromDynamoValue
            fieldMarshallersBuilder.put(fieldName, marshallerItem);
            fieldUnMarshallersBuilder.put(fieldName, unMarshallerItem);
        }

        // fromItem fromAttrVal ctor
        Constructor<T> objCtor = findConstructor(objClazz, objClazz.getDeclaredFields().length);
        objCtor.setAccessible(true);

        // fromItem
        ImmutableList<Function<Item, Object>> fromItemToCtorArgsList = fromItemToCtorArgsListBuilder.build();
        Function<Item, Object[]> fromItemToCtorArgs = item -> fromItemToCtorArgsList.stream()
                .map(u -> u.apply(item))
                .toArray();

        // fromAttrMap
        ImmutableList<Function<Map<String, AttributeValue>, Object>> fromAttrMapToCtorArgsList = fromAttrMapToCtorArgsListBuilder.build();
        Function<Map<String, AttributeValue>, Object[]> fromAttrMapToCtorArgs = attrMap -> fromAttrMapToCtorArgsList.stream()
                .map(u -> u.apply(attrMap))
                .toArray();

        // toItem toAttrVal other keys
        ImmutableMap<String, Function<T, Object>> objToFieldVals = objToFieldValsBuilder.build();
        ImmutableMap.Builder<String, Function<T, String>> toItemOtherKeysMapperBuilder = ImmutableMap.builder();
        for (DynamoTable dt : dynamoTables) {
            if (dt == dynamoTable) {
                continue;
            }
            checkState(!Strings.isNullOrEmpty(dt.rangePrefix()) || rangeKeys.length > 0,
                    "Must supply either list of range keys and/or a prefix for class %s", objClazz);
            if (dt.type() != Lsi) {
                ImmutableList<Function<T, Object>> dtPartitionKeyMappers = Arrays.stream(dt.partitionKeys())
                        .map(objToFieldVals::get)
                        .map(Preconditions::checkNotNull)
                        .collect(ImmutableList.toImmutableList());
                toItemOtherKeysMapperBuilder.put(
                        getPartitionKeyName(dt.type(), dt.indexNumber()),
                        obj -> StringSerdeUtil.mergeStrings(dtPartitionKeyMappers.stream()
                                .map(m -> m.apply(obj))
                                .map(GsonProvider.GSON::toJson)
                                .toArray(String[]::new)));
            }
            String dtRangePrefix = dt.rangePrefix();
            ImmutableList<Function<T, Object>> dtRangeKeyMappers = Arrays.stream(dt.rangeKeys())
                    .map(objToFieldVals::get)
                    .map(Preconditions::checkNotNull)
                    .collect(ImmutableList.toImmutableList());
            toItemOtherKeysMapperBuilder.put(
                    getRangeKeyName(dt.type(), dt.indexNumber()),
                    obj -> StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(dtRangePrefix), dtRangeKeyMappers.stream()
                            .map(m -> m.apply(obj))
                            .map(GsonProvider.GSON::toJson))
                            .toArray(String[]::new)));
        }
        ImmutableMap<String, Function<T, String>> toItemOtherKeysMapper = toItemOtherKeysMapperBuilder.build();
        Function<T, String> getPartitionKeyVal = obj -> StringSerdeUtil.mergeStrings(Arrays.stream(partitionKeyFields)
                .map(f -> {
                    try {
                        return GsonProvider.GSON.toJson(checkNotNull(f.get(obj)));
                    } catch (IllegalAccessException ex) {
                        throw new RuntimeException(ex);
                    }
                })
                .toArray(String[]::new));
        Function<T, String> getRangeKeyVal = obj -> StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(rangePrefix), Arrays.stream(rangeKeyFields)
                .map(f -> {
                    try {
                        return GsonProvider.GSON.toJson(checkNotNull(f.get(obj)));
                    } catch (IllegalAccessException ex) {
                        throw new RuntimeException(ex);
                    }
                }))
                .toArray(String[]::new));

        // toItem
        ImmutableList<BiConsumer<Item, T>> toItemArgs = toItemArgsBuilder.build();
        Function<T, Item> toItemMapper = obj -> {
            Item item = new Item();
            item.withPrimaryKey(partitionKeyName, getPartitionKeyVal.apply(obj),
                    rangeKeyName, getRangeKeyVal.apply(obj));
            toItemOtherKeysMapper.forEach(((keyName, objToKeyMapper) ->
                    item.withString(keyName, objToKeyMapper.apply(obj))));
            toItemArgs.forEach(m -> m.accept(item, obj));
            return item;
        };

        // toAttrMap
        ImmutableList<BiConsumer<ImmutableMap.Builder<String, AttributeValue>, T>> toAttrMapArgs = toAttrMapArgsBuilder.build();
        Function<T, ImmutableMap<String, AttributeValue>> toAttrMapMapper = obj -> {
            ImmutableMap.Builder<String, AttributeValue> attrMapBuilder = ImmutableMap.builder();
            attrMapBuilder.put(partitionKeyName, new AttributeValue(getPartitionKeyVal.apply(obj)));
            attrMapBuilder.put(rangeKeyName, new AttributeValue(getRangeKeyVal.apply(obj)));
            toItemOtherKeysMapper.forEach(((keyName, objToKeyMapper) ->
                    attrMapBuilder.put(keyName, new AttributeValue(objToKeyMapper.apply(obj)))));
            toAttrMapArgs.forEach(m -> m.accept(attrMapBuilder, obj));
            return attrMapBuilder.build();
        };

        // toDynamoValue fromDynamoValue
        ImmutableMap<String, MarshallerItem> fieldMarshallers = fieldMarshallersBuilder.build();
        ImmutableMap<String, UnMarshallerItem> fieldUnMarshallers = fieldUnMarshallersBuilder.build();

        return new SchemaImpl<T>(
                partitionKeys,
                rangeKeys,
                partitionKeyFields,
                rangeKeyFields,
                rangePrefix,
                tableName,
                partitionKeyName,
                rangeKeyName,
                table,
                index,
                fieldMarshallers,
                fieldUnMarshallers,
                fromItemToCtorArgs,
                fromAttrMapToCtorArgs,
                objCtor,
                toItemMapper,
                toAttrMapMapper);
    }

    private <T> Constructor<T> findConstructor(Class<T> objectClazz, int argc) {
        for (Constructor<?> constructorPotential : objectClazz.getDeclaredConstructors()) {
            // Let's only check for args size and assume all types are good...
            if (constructorPotential.getParameterCount() != argc) {
                log.trace("Unsuitable constructor {}", constructorPotential);
                continue;
            }
            return (Constructor<T>) constructorPotential;
        }
        throw new IllegalStateException("Cannot find constructor for class " + objectClazz.getSimpleName());
    }

    private boolean isSetClazz(Class<?> clazz) {
        return Set.class.isAssignableFrom(clazz);
    }

    private Optional<Class> getCollectionClazz(Class<?> clazz) {
        return Collection.class.isAssignableFrom(clazz) || Map.class.isAssignableFrom(clazz)
                ? Optional.of(clazz)
                : Optional.empty();
    }

    private Class getCollectionGeneric(Parameter parameter) {
        if (Map.class.isAssignableFrom(parameter.getType())) {
            return ((Class) ((ParameterizedType) parameter.getParameterizedType())
                    .getActualTypeArguments()[1]);
        } else {
            return ((Class) ((ParameterizedType) parameter.getParameterizedType())
                    .getActualTypeArguments()[0]);
        }
    }

    private Class getCollectionGeneric(Field field) {
        if (Map.class.isAssignableFrom(field.getType())) {
            return ((Class) ((ParameterizedType) field.getGenericType())
                    .getActualTypeArguments()[1]);
        } else {
            return ((Class) ((ParameterizedType) field.getGenericType())
                    .getActualTypeArguments()[0]);
        }
    }

    private MarshallerItem findMarshallerItem(Optional<Class> collectionClazz, Class itemClazz) {
        MarshallerItem f = findInClassSet(itemClazz, converters.mip).orElse(gsonMarshallerItem);
        if (collectionClazz.isPresent()) {
            CollectionMarshallerItem fc = findInClassSet(collectionClazz.get(), converters.mic).get();
            return (o, a, i) -> fc.marshall(o, a, i, f);
        } else {
            return f;
        }
    }

    private UnMarshallerItem findUnMarshallerItem(Optional<Class> collectionClazz, Class itemClazz) {
        UnMarshallerItem f = findInClassSet(itemClazz, converters.uip).orElseGet(() -> gsonUnMarshallerItem.apply(itemClazz));
        if (collectionClazz.isPresent()) {
            CollectionUnMarshallerItem fc = findInClassSet(collectionClazz.get(), converters.uic).get();
            return (a, i) -> fc.unmarshall(a, i, f);
        } else {
            return f;
        }
    }

    private MarshallerAttrVal findMarshallerAttrVal(Optional<Class> collectionClazz, Class itemClazz) {
        MarshallerAttrVal f = findInClassSet(itemClazz, converters.map).orElse(gsonMarshallerAttrVal);
        if (collectionClazz.isPresent()) {
            CollectionMarshallerAttrVal fc = findInClassSet(collectionClazz.get(), converters.mac).get();
            return o -> fc.marshall(o, f);
        } else {
            return f;
        }
    }

    private UnMarshallerAttrVal findUnMarshallerAttrVal(Optional<Class> collectionClazz, Class itemClazz) {
        UnMarshallerAttrVal f = findInClassSet(itemClazz, converters.uap).orElseGet(() -> gsonUnMarshallerAttrVal.apply(itemClazz));
        if (collectionClazz.isPresent()) {
            CollectionUnMarshallerAttrVal fc = findInClassSet(collectionClazz.get(), converters.uac).get();
            return a -> fc.unmarshall(a, f);
        } else {
            return f;
        }
    }

    private <T> Optional<T> findInClassSet(Class clazz, ImmutableSet<Map.Entry<Class<?>, T>> set) {
        for (Map.Entry<Class<?>, T> entry : set) {
            if (entry.getKey().isAssignableFrom(clazz)) {
                return Optional.of(entry.getValue());
            }
        }
        return Optional.empty();
    }

    public static class SchemaImpl<T> implements TableSchema<T>, IndexSchema<T> {
        private final String[] partitionKeys;
        private final String[] rangeKeys;
        private final Field[] partitionKeyFields;
        private final Field[] rangeKeyFields;
        private final String rangePrefix;
        private final String tableName;
        private final String partitionKeyName;
        private final String rangeKeyName;
        private final Table table;
        private final Index index;
        private final ImmutableMap<String, MarshallerItem> fieldMarshallers;
        private final ImmutableMap<String, UnMarshallerItem> fieldUnMarshallers;
        private final Function<Item, Object[]> fromItemToCtorArgs;
        private final Function<Map<String, AttributeValue>, Object[]> fromAttrMapToCtorArgs;
        private final Constructor<T> objCtor;
        private final Function<T, Item> toItemMapper;
        private final Function<T, ImmutableMap<String, AttributeValue>> toAttrMapMapper;

        public SchemaImpl(
                String[] partitionKeys,
                String[] rangeKeys,
                Field[] partitionKeyFields,
                Field[] rangeKeyFields,
                String rangePrefix,
                String tableName,
                String partitionKeyName,
                String rangeKeyName,
                Table table,
                Index index,
                ImmutableMap<String, MarshallerItem> fieldMarshallers,
                ImmutableMap<String, UnMarshallerItem> fieldUnMarshallers,
                Function<Item, Object[]> fromItemToCtorArgs,
                Function<Map<String, AttributeValue>, Object[]> fromAttrMapToCtorArgs,
                Constructor<T> objCtor, Function<T, Item> toItemMapper,
                Function<T, ImmutableMap<String, AttributeValue>> toAttrMapMapper) {
            this.partitionKeys = partitionKeys;
            this.rangeKeys = rangeKeys;
            this.partitionKeyFields = partitionKeyFields;
            this.rangeKeyFields = rangeKeyFields;
            this.rangePrefix = rangePrefix;
            this.tableName = tableName;
            this.partitionKeyName = partitionKeyName;
            this.rangeKeyName = rangeKeyName;
            this.table = table;
            this.index = index;
            this.fieldMarshallers = fieldMarshallers;
            this.fieldUnMarshallers = fieldUnMarshallers;
            this.fromItemToCtorArgs = fromItemToCtorArgs;
            this.fromAttrMapToCtorArgs = fromAttrMapToCtorArgs;
            this.objCtor = objCtor;
            this.toItemMapper = toItemMapper;
            this.toAttrMapMapper = toAttrMapMapper;
        }

        @Override
        public String tableName() {
            return tableName;
        }

        @Override
        public Table table() {
            return table;
        }

        @Override
        public String indexName() {
            return tableName;
        }

        @Override
        public Index index() {
            return index;
        }

        @Override
        public PrimaryKey primaryKey(T obj) {
            return new PrimaryKey(partitionKey(obj), rangeKey(obj));
        }

        @Override
        public PrimaryKey primaryKey(Map<String, Object> values) {
            checkState(partitionKeys.length + rangeKeys.length >= values.size(), "Unexpected extra values, partition keys %s range keys %s values %s", partitionKeys, rangeKeys, values);
            return new PrimaryKey(
                    new KeyAttribute(
                            partitionKeyName,
                            StringSerdeUtil.mergeStrings(Arrays.stream(partitionKeys)
                                    .map(partitionKey -> GsonProvider.GSON.toJson(checkNotNull(values.get(partitionKey), "Partition key missing value for %s", partitionKey)))
                                    .toArray(String[]::new))),
                    new KeyAttribute(
                            rangeKeyName,
                            StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(rangePrefix), Arrays.stream(rangeKeys)
                                    .map(rangeKey -> GsonProvider.GSON.toJson(checkNotNull(values.get(rangeKey), "Range key missing value for %s", rangeKey))))
                                    .toArray(String[]::new))));
        }

        @Override
        public String partitionKeyName() {
            return partitionKeyName;
        }

        @Override
        public KeyAttribute partitionKey(T obj) {
            return new KeyAttribute(
                    partitionKeyName,
                    StringSerdeUtil.mergeStrings(Arrays.stream(partitionKeyFields)
                            .map(partitionKeyField -> {
                                try {
                                    return GsonProvider.GSON.toJson(checkNotNull(partitionKeyField.get(obj),
                                            "Partition key value null, should add @NonNull on all keys for class %s", obj));
                                } catch (IllegalAccessException ex) {
                                    throw new RuntimeException(ex);
                                }
                            })
                            .toArray(String[]::new)));
        }

        @Override
        public KeyAttribute partitionKey(Map<String, Object> values) {
            String[] partitionValues = Arrays.stream(partitionKeys)
                    .map(partitionKey -> GsonProvider.GSON.toJson(checkNotNull(values.get(partitionKey), "Partition key missing value for %s", partitionKey)))
                    .toArray(String[]::new);
            checkState(partitionValues.length == values.size(), "Unexpected extra values, partition keys %s values %s", rangeKeys, values);
            return new KeyAttribute(
                    partitionKeyName,
                    StringSerdeUtil.mergeStrings(partitionValues));
        }

        @Override
        public String rangeKeyName() {
            return rangeKeyName;
        }

        @Override
        public KeyAttribute rangeKey(T obj) {
            return new KeyAttribute(
                    rangeKeyName,
                    StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(rangePrefix), Arrays.stream(rangeKeyFields)
                            .map(rangeKeyField -> {
                                try {
                                    return GsonProvider.GSON.toJson(checkNotNull(rangeKeyField.get(obj),
                                            "Range key value null, should add @NonNull on all keys for class %s", obj));
                                } catch (IllegalAccessException ex) {
                                    throw new RuntimeException(ex);
                                }
                            }))
                            .toArray(String[]::new)));
        }

        @Override
        public KeyAttribute rangeKey(Map<String, Object> values) {
            checkState(rangeKeys.length == values.size(), "Unexpected extra values, range keys %s values %s", rangeKeys, values);
            return new KeyAttribute(
                    rangeKeyName,
                    StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(rangePrefix), Arrays.stream(rangeKeys)
                            .map(rangeKey -> GsonProvider.GSON.toJson(checkNotNull(values.get(rangeKey), "Range key missing value for %s", rangeKey))))
                            .toArray(String[]::new)));
        }

        @Override
        public KeyAttribute rangeKeyPartial(Map<String, Object> values) {
            return new KeyAttribute(
                    rangeKeyName,
                    StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(rangePrefix), Arrays.stream(rangeKeys)
                            .map(values::get)
                            .takeWhile(Objects::nonNull)
                            .map(GsonProvider.GSON::toJson))
                            .toArray(String[]::new)));
        }

        @Override
        public String rangeValuePartial(Map<String, Object> values) {
            return StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(rangePrefix), Arrays.stream(rangeKeys)
                    .map(values::get)
                    .takeWhile(Objects::nonNull)
                    .map(GsonProvider.GSON::toJson))
                    .toArray(String[]::new));
        }

        @Override
        public Object toDynamoValue(String fieldName, Object object) {
            Item tempItem = new Item();
            checkNotNull(fieldMarshallers.get(fieldName), "Unknown field name %s", fieldName)
                    .marshall(object, "tempAttr", tempItem);
            return tempItem.get("tempAttr");
        }

        @Override
        public Object fromDynamoValue(String fieldName, Object object) {
            Item tempItem = new Item();
            tempItem.with("tempAttr", object);
            return checkNotNull(fieldUnMarshallers.get(fieldName), "Unknown field name %s", fieldName)
                    .unmarshall("tempAttr", tempItem);
        }

        @Override
        public Item toItem(T object) {
            if (object == null) {
                return null;
            }
            return toItemMapper.apply(object);
        }

        @Override
        public T fromItem(Item item) {
            // TODO check consistency of returning values. prevent user from updating fields that are also pk or sk in GSI or LSI
            if (item == null) {
                return null;
            }
            try {
                return objCtor.newInstance(fromItemToCtorArgs.apply(item));
            } catch (InstantiationException | IllegalAccessException | IllegalArgumentException | InvocationTargetException ex) {
                throw new RuntimeException("Failed to construct, item: " + item.toJSON() + " objCtor: " + objCtor.toString(), ex);
            }
        }

        @Override
        public ImmutableMap<String, AttributeValue> toAttrMap(T object) {
            if (object == null) {
                return null;
            }
            return toAttrMapMapper.apply(object);
        }

        @Override
        public T fromAttrMap(Map<String, AttributeValue> attrMap) {
            if (attrMap == null) {
                return null;
            }
            try {
                return objCtor.newInstance(fromAttrMapToCtorArgs.apply(attrMap));
            } catch (InstantiationException | IllegalAccessException | IllegalArgumentException | InvocationTargetException ex) {
                throw new RuntimeException(ex);
            }
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(DynamoMapper.class).to(DynamoMapperImpl.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoMapperImpl.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}