/*
 * SchemaREST.groovy — define el ObjectClass __ACCOUNT__ con sus atributos.
 * Se ejecuta una vez por Test Connection / Refresh Schema.
 */
import org.identityconnectors.framework.common.objects.AttributeInfoBuilder
import org.identityconnectors.framework.common.objects.ObjectClassInfoBuilder
import org.identityconnectors.framework.spi.Connector

def info = new ObjectClassInfoBuilder()
info.setType("__ACCOUNT__")
info.addAttributeInfo(AttributeInfoBuilder.define("username").build())
info.addAttributeInfo(AttributeInfoBuilder.define("displayName").build())
info.addAttributeInfo(AttributeInfoBuilder.define("extensionNumber")
    .setRequired(true)
    .setCreateable(true)
    .setUpdateable(false)
    .build())
info.addAttributeInfo(AttributeInfoBuilder.define("sipPassword")
    .setRequired(true)
    .setUpdateable(true)
    .build())
builder.defineObjectClass(info.build())
